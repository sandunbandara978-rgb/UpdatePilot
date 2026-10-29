import { Command } from 'commander';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec } from 'child_process';
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
  .description('UpdatePilot Windows Desktop Agent — Software Discovery & Safe Updates')
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

      console.log(`\x1b[32m✔ Host successfully paired!\x1b[0m`);
      console.log(`Device ID: ${result.deviceId}`);
      console.log(`Polling interval: ${result.pollingIntervalSec}s`);
      console.log(`Credentials securely encrypted and saved to Windows protected storage via DPAPI.`);
    } catch (err: unknown) {
      console.error(`\x1b[31m✖ Pairing failed:\x1b[0m`, err instanceof Error ? err.message : String(err));
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
    const creds = await credStore.loadCredentials();
    const check = await winget.checkAvailability();
    const wingetAvail = check.available;
    const wingetVer = check.version;

    console.log(`=== UpdatePilot Windows Agent (v${AGENT_VERSION}) ===`);
    console.log(`WinGet Status: ${wingetAvail ? `Available (v${wingetVer})` : 'NOT FOUND (Required for package operations)'}`);
    console.log(`Host: ${os.hostname()} [${os.type()} ${os.release()}]`);
    console.log(`Pairing Status: ${creds ? 'Paired' : 'Not Paired'}`);

    if (creds) {
      console.log(`Device ID: ${creds.deviceId}`);
      console.log(`Server URL: ${creds.serverUrl}`);
      console.log(`Paired At: ${creds.pairedAt}`);

      // Test connectivity
      try {
        const client = new AgentApiClient(creds.serverUrl, creds.token);
        await client.sendHeartbeat();
        console.log(`Backend Connectivity: \x1b[32mConnected & Authenticated\x1b[0m`);
      } catch (err) {
        console.log(`Backend Connectivity: \x1b[31mDisconnected or Token Revoked\x1b[0m (${err instanceof Error ? err.message : String(err)})`);
      }
    } else {
      console.log(`\nTo pair this device, run:`);
      console.log(`  updatepilot-agent pair --code <PAIRING_CODE> --server <SERVER_URL>`);
      console.log(`Or run the interactive setup wizard:`);
      console.log(`  updatepilot-agent setup`);
    }
  });

/**
 * SCAN COMMAND
 */
program
  .command('scan')
  .description('Discover installed software on this machine')
  .option('--submit', 'Submit scan results to UpdatePilot server')
  .action(async (opts) => {
    try {
      console.log(`[UpdatePilot Agent] Scanning installed applications via WinGet...`);
      const apps = await discovery.runDiscovery();
      console.log(`Found ${apps.length} applications.\n`);

      if (opts.submit) {
        const creds = await credStore.loadCredentials();
        if (!creds) {
          console.error(`\x1b[31mCannot submit: Device is not paired.\x1b[0m`);
          process.exit(1);
        }
        const client = new AgentApiClient(creds.serverUrl, creds.token);
        const scanId = `manual_scan_${Date.now()}`;
        console.log(`Submitting inventory to ${creds.serverUrl}...`);
        await client.submitScan(scanId, apps);
        console.log(`\x1b[32m✔ Scan results submitted successfully!\x1b[0m`);
      } else {
        console.log(`Discovered software sample (first 15):`);
        apps.slice(0, 15).forEach((a) =>
          console.log(` - ${a.name} [${a.packageId || 'No ID'}] (v${a.installedVersion}${a.availableVersion ? ` -> v${a.availableVersion}` : ''})`)
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
 * SERVICE COMMAND (Continuous outbound polling with singleton lock)
 */
program
  .command('service')
  .description('Run agent service worker (outbound heartbeat and job execution)')
  .action(async () => {
    const creds = await credStore.loadCredentials();
    if (!creds) {
      console.error(`\x1b[31mAgent is not paired! Please pair first using "updatepilot-agent setup" or "updatepilot-agent pair --code <CODE>".\x1b[0m`);
      process.exit(1);
    }

    // Process singleton lock
    const lockDir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'UpdatePilot');
    const lockFile = path.join(lockDir, 'agent.pid');

    try {
      if (fs.existsSync(lockFile)) {
        const existingPid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
        if (existingPid && existingPid !== process.pid) {
          try {
            process.kill(existingPid, 0);
            console.error(`\x1b[33m[UpdatePilot Agent] Another worker instance is already running (PID: ${existingPid}). Exiting to prevent duplicate execution.\x1b[0m`);
            process.exit(0);
          } catch {
            // Lock was stale
          }
        }
      }
      if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });
      fs.writeFileSync(lockFile, String(process.pid), 'utf-8');
    } catch {
      // ignore
    }

    const cleanupLock = () => {
      try {
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      } catch {}
    };
    process.on('exit', cleanupLock);
    process.on('SIGINT', () => { cleanupLock(); process.exit(0); });
    process.on('SIGTERM', () => { cleanupLock(); process.exit(0); });

    const client = new AgentApiClient(creds.serverUrl, creds.token);
    console.log(`[UpdatePilot Agent] Starting outbound worker service for device ${creds.deviceId}...`);
    console.log(`Connected to: ${creds.serverUrl}`);

    let isShuttingDown = false;
    process.on('SIGINT', () => {
      console.log('\n[UpdatePilot Agent] Shutting down service cleanly...');
      isShuttingDown = true;
      cleanupLock();
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
      console.warn(`Initial sync notice:`, err);
    }

    // 2. Continuous Outbound Polling Loop
    const pollInterval = 15000; // 15 seconds
    const heartbeatInterval = 30000; // 30 seconds
    let lastHeartbeat = Date.now();

    const loop = async () => {
      if (isShuttingDown) return;

      try {
        if (Date.now() - lastHeartbeat >= heartbeatInterval) {
          await client.sendHeartbeat();
          lastHeartbeat = Date.now();
        }

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
                console.log(`\x1b[32m✔ Verified! Installed version is ${verification.actualInstalledVersion}\x1b[0m`);
                await client.reportJob(job.id, {
                  status: 'COMPLETED',
                  exitCode: upgradeRes.exitCode,
                  verifiedVersion: verification.actualInstalledVersion,
                  logs: upgradeRes.stdout + '\n' + verification.details,
                });
              } else {
                console.warn(`\x1b[33m⚠ Verification failed: ${verification.details}\x1b[0m`);
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
 * SETUP COMMAND (Interactive CLI Wizard for nontechnical users)
 */
program
  .command('setup')
  .description('Interactive First-Run Setup & Pairing Wizard')
  .action(async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query: string): Promise<string> =>
      new Promise((resolve) => rl.question(query, resolve));

    console.log(`\n============================================================`);
    console.log(`           UPDATEPILOT AGENT — SETUP & PAIRING WIZARD`);
    console.log(`============================================================\n`);

    const existingCreds = await credStore.loadCredentials();
    if (existingCreds) {
      console.log(`Current Status: \x1b[32mAlready Paired\x1b[0m`);
      console.log(`Device ID:  ${existingCreds.deviceId}`);
      console.log(`Server URL: ${existingCreds.serverUrl}\n`);

      const repair = await question('Would you like to re-pair this device? (y/N): ');
      if (repair.trim().toLowerCase() !== 'y') {
        console.log('\nExiting setup wizard.');
        rl.close();
        return;
      }
    }

    console.log(`Step 1: Enter your UpdatePilot Central Dashboard URL.`);
    console.log(`  - For a remote server: enter e.g. https://updatepilot.yourcompany.com`);
    console.log(`  - Note: "localhost" refers ONLY to this computer, not a remote server.`);
    const serverInput = await question(`Server URL [default: http://localhost:3000]: `);
    const serverUrl = serverInput.trim() || 'http://localhost:3000';

    // Test connectivity
    console.log(`\nTesting connection to ${serverUrl}...`);
    try {
      const client = new AgentApiClient(serverUrl);
      const isReachable = await client.testConnectivity();
      if (!isReachable) {
        console.warn(`\x1b[33mWarning: Server did not return a valid response. Proceeding, but pairing may fail.\x1b[0m`);
      } else {
        console.log(`\x1b[32m✔ Server is reachable!\x1b[0m`);
      }
    } catch (err) {
      console.warn(`\x1b[33mWarning: Connection test threw an error (${err instanceof Error ? err.message : String(err)}).\x1b[0m`);
    }

    console.log(`\nStep 2: Enter the 6-digit pairing code.`);
    console.log(`  (Generate this code from the web dashboard under "Connect Agent")`);
    const codeInput = await question(`Pairing Code (e.g. UP-123456): `);
    const code = codeInput.trim().toUpperCase();

    if (!code) {
      console.error(`\x1b[31mError: Pairing code is required.\x1b[0m`);
      rl.close();
      return;
    }

    console.log(`\nPairing device with ${serverUrl}...`);
    try {
      const client = new AgentApiClient(serverUrl);
      const deviceName = os.hostname();
      const osVersion = `${os.type()} ${os.release()} (${os.arch()})`;

      const result = await client.pair(code, deviceName, osVersion, AGENT_VERSION);
      await credStore.saveCredentials({
        serverUrl,
        deviceId: result.deviceId,
        token: result.token,
        pairedAt: new Date().toISOString(),
      });

      console.log(`\n\x1b[32m============================================================`);
      console.log(`✔ SUCCESS: Device successfully paired with UpdatePilot!`);
      console.log(`Device ID: ${result.deviceId}`);
      console.log(`============================================================\x1b[0m\n`);

      const openDash = await question('Open the web dashboard in your default browser? (Y/n): ');
      if (openDash.trim().toLowerCase() !== 'n') {
        const startCmd = process.platform === 'win32' ? `start ${serverUrl}` : `open ${serverUrl}`;
        exec(startCmd);
      }
    } catch (err) {
      console.error(`\n\x1b[31m✖ Pairing failed:\x1b[0m`, err instanceof Error ? err.message : String(err));
      console.log(`Please ensure the code is valid, has not expired (10m validity), and was not already used.`);
    }

    rl.close();
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
