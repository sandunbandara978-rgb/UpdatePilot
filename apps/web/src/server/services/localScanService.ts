import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { deviceRepo, applicationRepo, auditRepo, memoryStore } from '../repositories';
import { compareVersions, ApplicationStatus, SAFE_PACKAGE_ID_REGEX } from '@updatepilot/shared';

const execFileAsync = promisify(execFile);

export interface LocalScanResult {
  deviceId: string;
  deviceName: string;
  osVersion: string;
  appsSaved: number;
  updatesCount: number;
}

/** Parsed row from `winget list` or `winget upgrade` */
interface WinGetRow {
  name: string;
  packageId?: string | null;
  installedVersion: string;
  availableVersion?: string | null;
  source?: string | null;
}

export class LocalScanService {
  /**
   * Check if WinGet is installed and usable on this system
   */
  async checkWinGet(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync('winget', ['--version']);
      return { available: true, version: stdout.trim() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, error: msg };
    }
  }

  /**
   * Executes a real-time dual-command scan on the current machine:
   *   1. `winget upgrade` → authoritative list of packages that have updates (with real available versions)
   *   2. `winget list`    → full installed inventory
   * Merges results so every package that winget upgrade reports gets status UPDATE_AVAILABLE
   * and the correct available version — regardless of whether winget list shows the Available column.
   */
  async scanLocalHost(userId: string = 'usr_default_admin'): Promise<LocalScanResult> {
    const check = await this.checkWinGet();
    if (!check.available) {
      throw new Error(`WinGet is not available on this host: ${check.error}`);
    }

    // 1. Run winget list AND winget upgrade in parallel for speed
    const [listResult, upgradeResult] = await Promise.allSettled([
      execFileAsync('winget', ['list', '--accept-source-agreements'], {
        maxBuffer: 15 * 1024 * 1024,
      }),
      execFileAsync('winget', ['upgrade', '--accept-source-agreements'], {
        maxBuffer: 15 * 1024 * 1024,
      }),
    ]);

    const listStdout = listResult.status === 'fulfilled' ? listResult.value.stdout : '';
    const upgradeStdout = upgradeResult.status === 'fulfilled' ? upgradeResult.value.stdout : '';

    if (!listStdout) {
      throw new Error('winget list returned no output. WinGet may not be fully initialised.');
    }

    // 2. Parse both outputs
    const installed = this.parseWinGetOutput(listStdout);
    const upgradable = this.parseWinGetOutput(upgradeStdout);

    // 3. Build a lookup map from winget upgrade: packageId → availableVersion
    //    This is the authoritative real-time update catalog from Windows Package Manager.
    const upgradeMap = new Map<string, string>();
    for (const row of upgradable) {
      if (row.packageId && row.availableVersion) {
        upgradeMap.set(row.packageId.toLowerCase(), row.availableVersion);
      }
    }

    // 4. Identify or register local device
    const hostname = os.hostname();
    const osVersion = `${os.type()} ${os.release()} (${os.arch()})`;
    const localDeviceId = `dev_${hostname.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    let device = await deviceRepo.findById(localDeviceId);
    if (!device) {
      const allDevices = await deviceRepo.listByUserId(userId);
      device =
        allDevices.find(
          (d) =>
            d.deviceName.toLowerCase().includes(hostname.toLowerCase()) ||
            d.id === localDeviceId
        ) || null;
    }

    if (!device) {
      device = await deviceRepo.create({
        userId,
        deviceName: `${hostname} (This PC)`,
        osVersion,
        agentVersion: '1.0.0 (Local Engine)',
        status: 'ONLINE',
        lastSeenAt: new Date().toISOString(),
      });
    } else {
      await deviceRepo.update(device.id, {
        status: 'ONLINE',
        lastSeenAt: new Date().toISOString(),
        osVersion,
      });
    }

    // 5. Clear demo fixture if present so user sees REAL data
    if (typeof (memoryStore as any)?.clearDemoFixture === 'function') {
      (memoryStore as any).clearDemoFixture();
    }

    // 6. Classify versions using the merged upgrade map as authoritative source
    let updatesCount = 0;
    const processedApps = installed.map((raw) => {
      let status: ApplicationStatus = 'UP_TO_DATE';
      let resolvedAvailable = raw.availableVersion || null;

      if (!raw.packageId) {
        // No WinGet package identity — treat as UNMATCHED/UNSUPPORTED
        status = raw.source === 'local_registry' ? 'UNMATCHED' : 'UNSUPPORTED';
      } else {
        // Override available version from winget upgrade output if present
        // This is the real-time authoritative check — winget upgrade is more reliable
        // than the Available column in winget list (which is sometimes blank).
        const upgradeAvailable = upgradeMap.get(raw.packageId.toLowerCase());
        if (upgradeAvailable) {
          resolvedAvailable = upgradeAvailable;
        }

        if (resolvedAvailable) {
          const cmp = compareVersions(raw.installedVersion, resolvedAvailable);
          if (cmp === -1) {
            status = 'UPDATE_AVAILABLE';
            updatesCount++;
          } else if (cmp === 0 || cmp === 1) {
            status = 'UP_TO_DATE';
          } else {
            status = 'UNKNOWN_VERSION';
          }
        } else {
          // Package has a WinGet ID but winget upgrade did NOT list it → it is up to date
          status = 'UP_TO_DATE';
        }
      }

      return {
        name: raw.name,
        packageId: raw.packageId || null,
        publisher: null,
        installedVersion: raw.installedVersion,
        availableVersion: resolvedAvailable,
        source: raw.source || (raw.packageId ? 'winget' : null),
        status,
      };
    });

    // 7. Upsert apps into repository
    const appsSaved = await applicationRepo.upsertMany(device.id, processedApps);

    // 8. Record audit event
    await auditRepo.record({
      userId,
      deviceId: device.id,
      eventType: 'SCAN_COMPLETED',
      action: `Executed real-time host software scan on ${hostname} (winget list + winget upgrade)`,
      target: device.deviceName,
      metadata: { appsSaved, updatesCount, wingetVersion: check.version },
    });

    return {
      deviceId: device.id,
      deviceName: device.deviceName,
      osVersion,
      appsSaved,
      updatesCount,
    };
  }

  /**
   * Parses the tabular text output of either `winget list` or `winget upgrade`.
   * Both commands use the same column layout: Name | Id | Version | Available | Source
   */
  private parseWinGetOutput(output: string): WinGetRow[] {
    const cleanOutput = output.replace(/\r(?!\n)/g, '\n');
    const lines = cleanOutput.split(/\r?\n/);
    const rows: WinGetRow[] = [];

    let separatorIdx = -1;
    let headerLine = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^-{5,}/.test(line.trim())) {
        separatorIdx = i;
        headerLine = lines[i - 1] || '';
        break;
      }
    }

    if (separatorIdx === -1 || !headerLine) {
      return rows;
    }

    const nameCol = headerLine.indexOf('Name');
    const idCol = headerLine.indexOf('Id');
    const versionCol = headerLine.indexOf('Version');
    const availCol = headerLine.indexOf('Available');
    const sourceCol = headerLine.indexOf('Source');

    for (let i = separatorIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      if (
        line.includes('<additional entries truncated') ||
        line.includes('agreements') ||
        line.includes('upgrades available') ||
        /^\d+ upgrades? available/.test(line.trim())
      ) {
        continue;
      }

      let name = '';
      let packageId: string | undefined = undefined;
      let version = '';
      let availableVersion: string | undefined = undefined;
      let source: string | undefined = undefined;

      if (idCol !== -1 && versionCol !== -1) {
        name = line.substring(nameCol, idCol).trim();
        packageId = line.substring(idCol, versionCol).trim() || undefined;

        if (availCol !== -1) {
          version = line.substring(versionCol, availCol).trim();
          if (sourceCol !== -1) {
            availableVersion = line.substring(availCol, sourceCol).trim() || undefined;
            source = line.substring(sourceCol).trim() || undefined;
          } else {
            availableVersion = line.substring(availCol).trim() || undefined;
          }
        } else {
          version = line.substring(versionCol).trim();
        }
      } else {
        const tokens = line.trim().split(/\s{2,}/);
        if (tokens.length >= 2) {
          name = tokens[0] || '';
          packageId = tokens[1];
          version = tokens[2] || 'unknown';
          availableVersion = tokens[3];
          source = tokens[4];
        }
      }

      if (name && version) {
        // Strip ARP (Add/Remove Programs only) entries — no WinGet identity
        if (packageId && packageId.startsWith('ARP\\')) {
          packageId = undefined;
        }

        // Validate package ID format against allowlist
        if (packageId && !SAFE_PACKAGE_ID_REGEX.test(packageId)) {
          packageId = undefined;
        }

        // Discard empty / placeholder available versions
        if (availableVersion === 'Unknown' || availableVersion === '') {
          availableVersion = undefined;
        }

        rows.push({
          name,
          packageId: packageId || null,
          installedVersion: version,
          availableVersion: availableVersion || null,
          source: source || (packageId ? 'winget' : null),
        });
      }
    }

    return rows;
  }
}

export const localScanService = new LocalScanService();
