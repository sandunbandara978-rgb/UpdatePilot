import { Command } from 'commander';
import * as os from 'os';
import { CredentialStore } from './security/credentialStore';
import { AgentApiClient } from './core/apiClient';
import { WinGetAdapter } from './adapters/wingetAdapter';
import { DiscoveryEngine } from './core/discoveryEngine';
import { VerificationEngine } from './core/verificationEngine';

const program = new Command();
const credStore = new CredentialStore();
const winget = new WinGetAdapter();
const discovery = new DiscoveryEngine(winget);
const verifier = new VerificationEngine(winget);

const AGENT_VERSION = '1.0.0';

program
  .name('updatepilot-agent')
  .description('UpdatePilot Windows Desktop Agent â€” Software Discovery & Safe Updates')
  .version(AGENT_VERSION);

/**
 * PAIR COMMAND
 */
program
  .command('pair')
  .description('Pair this Windows host with UpdatePilot web platform')
  .requiredOption('-c, --code <pairingCode>', 'One-time pairing code generated from UpdatePilot dashboard')
  .option('-s, --server <url>', 'UpdatePilot server URL', 'http://localhost:3000')
  .action(async (opts) => {
    try {
      console.log(`[UpdatePilot Agent] Initiating secure pairing with ${opts.server}...`);
      const client = new AgentApiClient(opts.server);
      const deviceName = os.hostname();
      const osVersion = `${os.type()} ${os.release()} (${os.arch()})`;

      const result = await client.pair(opts.code, deviceName, osVersion, AGENT_VERSION);
      await credStore.saveCredentials({
        serverUrl: opts.server,
        deviceId: result.deviceId,
        token: result.token,
        pairedAt: new Date().toISOString(),
      });

      console.log(`\x1b[32mâœ” Host successfully paired!\x1b[0m`);
      console.log(`Device ID: ${result.deviceId}`);
      console.log(`Polling interval: ${result.pollingIntervalSec}s`);
      console.log(`Credentials securely encrypted and saved to Windows protected storage.`);
    } catch (err: unknown) {
      console.error(`\x1b[31mâœ– Pairing failed:\x1b[0m`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * STATUS COMMAND
 */
program
  .command('status')
  .description('Check agent pairing status, host info, and WinGet availability')
  .action(async () => {
    console.log(`=== UpdatePilot Windows Agent (v${AGENT_VERSION}) ===`);
    const wingetCheck = await winget.checkAvailability();
    console.log(`WinGet Status: ${wingetCheck.available ? `\x1b[32mAvailable (${wingetCheck.version})\x1b[0m` : `\x1b[31mUnavailable (${wingetCheck.error})\x1b[0m`}`);
    console.log(`Host: ${os.hostname()} [${os.type()} ${os.release()}]`);

    const creds = await credStore.loadCredentials();
    if (!creds) {
      console.log(`Pairing Status: \x1b[33mNot Paired\x1b[0m (Run "updatepilot-agent pair --code <code>")`);
      return;
    }

    console.log(`Pairing Status: \x1b[32mPaired\x1b[0m`);
    console.log(`Device ID: ${creds.deviceId}`);
    console.log(`Server URL: ${creds.serverUrl}`);
    console.log(`Paired At: ${creds.pairedAt}`);

    try {
      const client = new AgentApiClient(creds.serverUrl, creds.token);
      await client.sendHeartbeat();
      console.log(`Backend Connectivity: \x1b[32mConnected & Authenticated\x1b[0m`);
    } catch (err: unknown) {
      console.log(`Backend Connectivity: \x1b[31mError connecting to server (${err instanceof Error ? err.message : String(err)})\x1b[0m`);
    }
  });

/**
 * SCAN COMMAND
 */
program
  .command('scan')
  .description('Perform immediate software discovery on this Windows host')
  .option('--submit', 'Submit scan results to paired server', false)
  .action(async (opts) => {
    try {
      console.log(`[UpdatePilot Agent] Scanning installed software via WinGet...`);
      const apps = await discovery.runDiscovery();
      console.log(`Discovered ${apps.length} installed applications.`);

      const updates = apps.filter((a) => a.availableVersion);
      console.log(`Updates available for ${updates.length} applications.`);

      if (opts.submit) {
        const creds = await credStore.loadCredentials();
        if (!creds) {
          console.error(`\x1b[31mCannot submit scan: Agent is not paired.\x1b[0m`);
          process.exit(1);
        }
        const client = new AgentApiClient(creds.serverUrl, creds.token);
        const res = await client.submitScan('manual_scan_' + Date.now(), apps);
        console.log(`\x1b[32mâœ” Scan submitted successfully to ${creds.serverUrl}! (${res.appsSaved} applications recorded)\x1b[0m`);
      } else {
        console.table(
          apps.slice(0, 15).map((a) => ({
            Name: a.name.substring(0, 30),
            PackageId: a.packageId || '(unmatched)',
            Installed: a.installedVersion,
            Available: a.availableVersion || 'Up to date',
          }))
        );
        if (apps.length > 15) {
          console.log(`... and ${apps.length - 15} more applications.`);
        }
      }
    } catch (err: unknown) {
      console.error(`\x1b[31mScan failed:\x1b[0m`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * SERVICE COMMAND (Continuous outbound polling)
 */
program
  .command('service')
  .description('Run agent service worker (outbound heartbeat and job execution)')
  .action(async () => {
    const creds = await credStore.loadCredentials();
    if (!creds) {
      console.error(`\x1b[31mAgent is not paired! Please pair first using "updatepilot-agent pair --code <CODE>".\x1b[0m`);
      process.exit(1);
    }

    const client = new AgentApiClient(creds.serverUrl, creds.token);
    console.log(`[UpdatePilot Agent] Starting outbound worker service for device ${creds.deviceId}...`);
    console.log(`Connected to: ${creds.serverUrl}`);

    let isShuttingDown = false;
    process.on('SIGINT', () => {
      console.log('\n[UpdatePilot Agent] Shutting down service cleanly...');
      isShuttingDown = true;
      process.exit(0);
    });

    // 1. Initial Heartbeat & Software Discovery
    try {
      await client.sendHeartbeat();
      console.log(`Initial heartbeat dispatched.`);
      console.log(`Performing baseline inventory discovery...`);
      const apps = await discovery.runDiscovery();
      await client.submitScan('startup_scan_' + Date.now(), apps);
      console.log(`Baseline inventory discovered (${apps.length} applications) and synchronized with dashboard.`);
    } catch (err) {
      console.warn(`Initial sync warning:`, err);
    }

    // 2. Continuous Outbound Polling Loop
    const pollInterval = 15000; // 15 seconds
    const heartbeatInterval = 30000; // 30 seconds
    let lastHeartbeat = Date.now();

    const loop = async () => {
      if (isShuttingDown) return;

      try {
        // Send periodic heartbeat
        if (Date.now() - lastHeartbeat >= heartbeatInterval) {
          await client.sendHeartbeat();
          lastHeartbeat = Date.now();
        }

        // Poll for pending jobs
        const pollRes = await client.pollJobs();
        if (pollRes && pollRes.job) {
          const job = pollRes.job;
          console.log(`[UpdatePilot Agent] Discovered pending ${job.type} job (ID: ${job.id})`);

          // Claim job atomically
          await client.claimJob(job.id);
          console.log(`[UpdatePilot Agent] Claimed job ${job.id}`);

          if (job.type === 'SCAN') {
            await client.reportJob(job.id, { status: 'RUNNING', logs: 'Executing full software inventory discovery...' });
            const apps = await discovery.runDiscovery();
            await client.submitScan(job.id, apps);
            await client.reportJob(job.id, {
              status: 'COMPLETED',
              logs: `Successfully discovered ${apps.length} applications.`,
            });
            console.log(`[UpdatePilot Agent] Scan job ${job.id} completed.`);
          } else if (job.type === 'UPDATE') {
            const { packageId, targetVersion } = job.payload;
            if (!packageId || !targetVersion) {
              await client.reportJob(job.id, {
                status: 'FAILED',
                errorDetails: 'Invalid job payload: packageId or targetVersion missing.',
              });
              return;
            }

            console.log(`[UpdatePilot Agent] Starting verified upgrade for package "${packageId}" to "${targetVersion}"...`);
            await client.reportJob(job.id, {
              status: 'RUNNING',
              logs: `Starting WinGet upgrade for ${packageId} to version ${targetVersion}...`,
            });

            // Execute upgrade bound strictly to approved targetVersion
            const upgradeRes = await winget.upgradePackage(packageId, targetVersion);

            if (!upgradeRes.success && !upgradeRes.restartRequired) {
              console.error(`[UpdatePilot Agent] Upgrade failed with exit code ${upgradeRes.exitCode}`);
              await client.reportJob(job.id, {
                status: 'FAILED',
                exitCode: upgradeRes.exitCode,
                logs: upgradeRes.stdout + '\n' + upgradeRes.stderr,
                errorDetails: upgradeRes.error || `WinGet exited with code ${upgradeRes.exitCode}`,
              });
            } else if (upgradeRes.restartRequired) {
              console.log(`[UpdatePilot Agent] Upgrade requires system restart.`);
              await client.reportJob(job.id, {
                status: 'RESTART_REQUIRED',
                exitCode: upgradeRes.exitCode,
                logs: upgradeRes.stdout,
              });
            } else {
              // Post-upgrade verification step
              console.log(`[UpdatePilot Agent] Upgrade process finished. Verifying installed version...`);
              await client.reportJob(job.id, {
                status: 'VERIFYING',
                logs: 'Inspecting installed inventory to verify version change...',
              });

              const verification = await verifier.verifyUpgrade(packageId, targetVersion);
              if (verification.verified) {
                console.log(`\x1b[32mâœ” Verified! Installed version is ${verification.actualInstalledVersion}\x1b[0m`);
                await client.reportJob(job.id, {
                  status: 'COMPLETED',
                  exitCode: upgradeRes.exitCode,
                  verifiedVersion: verification.actualInstalledVersion,
                  logs: upgradeRes.stdout + '\n' + verification.details,
                });
              } else {
                console.warn(`\x1b[33mâš  Verification failed: ${verification.details}\x1b[0m`);
                await client.reportJob(job.id, {
                  status: 'FAILED',
                  exitCode: upgradeRes.exitCode,
                  errorDetails: verification.details,
                  logs: upgradeRes.stdout,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[UpdatePilot Agent] Polling cycle error:`, err instanceof Error ? err.message : String(err));
      }

      setTimeout(loop, pollInterval);
    };

    loop();
  });

/**
 * UNPAIR COMMAND
 */
program
  .command('unpair')
  .description('Clear local credentials and disconnect from UpdatePilot')
  .action(async () => {
    credStore.clearCredentials();
    console.log(`\x1b[32mLocal credentials cleared. Host is now unpaired.\x1b[0m`);
  });

program.parse(process.argv);
