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
   * Executes a direct WinGet scan on the current machine and saves all discovered
   * software and available updates into the database.
   */
  async scanLocalHost(userId: string = 'usr_default_admin'): Promise<LocalScanResult> {
    const check = await this.checkWinGet();
    if (!check.available) {
      throw new Error(`WinGet is not available on this host: ${check.error}`);
    }

    // 1. Run winget list
    const { stdout } = await execFileAsync(
      'winget',
      ['list', '--accept-source-agreements'],
      { maxBuffer: 15 * 1024 * 1024 }
    );

    const discovered = this.parseWinGetList(stdout);

    // 2. Identify or register local device
    const hostname = os.hostname();
    const osVersion = `${os.type()} ${os.release()} (${os.arch()})`;
    const localDeviceId = `dev_${hostname.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    // Look for existing device
    let device = await deviceRepo.findById(localDeviceId);
    if (!device) {
      const allDevices = await deviceRepo.listByUserId(userId);
      device = allDevices.find(
        (d) => d.deviceName.toLowerCase().includes(hostname.toLowerCase()) || d.id === localDeviceId
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

    // 3. Clear demo fixture if present so user sees REAL data
    if (typeof (memoryStore as any)?.clearDemoFixture === 'function') {
      (memoryStore as any).clearDemoFixture();
    }

    // 4. Classify versions and determine update status
    let updatesCount = 0;
    const processedApps = discovered.map((raw) => {
      let status: ApplicationStatus = 'UP_TO_DATE';

      if (!raw.packageId) {
        status = raw.source === 'local_registry' ? 'UNMATCHED' : 'UNSUPPORTED';
      } else if (raw.availableVersion) {
        const cmp = compareVersions(raw.installedVersion, raw.availableVersion);
        if (cmp === -1) {
          status = 'UPDATE_AVAILABLE';
          updatesCount++;
        } else if (cmp === 0 || cmp === 1) {
          status = 'UP_TO_DATE';
        } else {
          status = 'UNKNOWN_VERSION';
        }
      } else {
        status = 'UP_TO_DATE';
      }

      return {
        name: raw.name,
        packageId: raw.packageId || null,
        publisher: raw.publisher || null,
        installedVersion: raw.installedVersion,
        availableVersion: raw.availableVersion || null,
        source: raw.source || (raw.packageId ? 'winget' : null),
        status,
      };
    });

    // 5. Upsert apps into repository
    const appsSaved = await applicationRepo.upsertMany(device.id, processedApps);

    // 6. Record audit event
    await auditRepo.record({
      userId,
      deviceId: device.id,
      eventType: 'SCAN_COMPLETED',
      action: `Executed direct host software scan on ${hostname}`,
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
   * Parses the text output of `winget list`
   */
  private parseWinGetList(output: string): Array<{
    name: string;
    packageId?: string | null;
    publisher?: string | null;
    installedVersion: string;
    availableVersion?: string | null;
    source?: string | null;
  }> {
    const cleanOutput = output.replace(/\r(?!\n)/g, '\n');
    const lines = cleanOutput.split(/\r?\n/);
    const apps: Array<{
      name: string;
      packageId?: string | null;
      publisher?: string | null;
      installedVersion: string;
      availableVersion?: string | null;
      source?: string | null;
    }> = [];

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
      return apps;
    }

    const nameCol = headerLine.indexOf('Name');
    const idCol = headerLine.indexOf('Id');
    const versionCol = headerLine.indexOf('Version');
    const availCol = headerLine.indexOf('Available');
    const sourceCol = headerLine.indexOf('Source');

    for (let i = separatorIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      if (line.includes('<additional entries truncated') || line.includes('agreements')) continue;

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
        if (packageId && packageId.startsWith('ARP\\')) {
          packageId = undefined;
        }

        // Validate package ID format
        if (packageId && !SAFE_PACKAGE_ID_REGEX.test(packageId)) {
          packageId = undefined;
        }

        apps.push({
          name,
          packageId: packageId || null,
          publisher: null,
          installedVersion: version,
          availableVersion: availableVersion || null,
          source: source || (packageId ? 'winget' : null),
        });
      }
    }

    return apps;
  }
}

export const localScanService = new LocalScanService();
