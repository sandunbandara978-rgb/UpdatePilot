import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Strict regex pattern for safe package IDs (WinGet, reverse-domain, MSIX, and GUID format)
export const SAFE_PACKAGE_ID_REGEX = /^[A-Za-z0-9_\-\.\+\\/\{\}]+$/;

export interface WinGetApp {
  name: string;
  packageId?: string;
  version: string;
  availableVersion?: string;
  source?: string;
}

export interface WinGetPackageDetails {
  packageId: string;
  name: string;
  version: string;
  publisher?: string;
  publisherUrl?: string;
  author?: string;
  description?: string;
  homepage?: string;
  license?: string;
  licenseUrl?: string;
  releaseNotesUrl?: string;
  installerType?: string;
  installerUrl?: string;
  sha256?: string;
  releaseDate?: string;
}

export interface UpgradeResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  restartRequired: boolean;
  error?: string;
}

export class WinGetAdapter {
  private wingetExecutable = 'winget';

  /**
   * Check if WinGet is installed and return its version
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync(this.wingetExecutable, ['--version']);
      const version = stdout.trim();
      return { available: true, version };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, error: msg };
    }
  }

  /**
   * Discover installed applications via `winget list`
   */
  async listInstalledApps(): Promise<WinGetApp[]> {
    try {
      // Execute winget list with non-interactive agreement flags
      const { stdout } = await execFileAsync(
        this.wingetExecutable,
        ['list', '--accept-source-agreements'],
        { maxBuffer: 10 * 1024 * 1024 }
      );

      return this.parseListOutput(stdout);
    } catch (err: unknown) {
      console.error('Error executing winget list:', err);
      throw new Error(`Failed to list applications via WinGet: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Parses the tabular text output of `winget list`
   */
  parseListOutput(output: string): WinGetApp[] {
    const lines = output.split(/\r?\n/);
    const apps: WinGetApp[] = [];

    // Find the header separator line containing dashes (e.g. "-------------------")
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

    // Determine column start indices from header
    const nameCol = headerLine.indexOf('Name');
    const idCol = headerLine.indexOf('Id');
    const versionCol = headerLine.indexOf('Version');
    const availCol = headerLine.indexOf('Available');
    const sourceCol = headerLine.indexOf('Source');

    // Parse each line after separator
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
        // Fallback tokenization if column offsets fail
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
        // Filter out ARP noise or clean package IDs
        if (packageId && packageId.startsWith('ARP\\')) {
          packageId = undefined; // Not an official winget package ID
        }

        apps.push({
          name,
          packageId,
          version,
          availableVersion,
          source: source || (packageId ? 'winget' : undefined),
        });
      }
    }

    return apps;
  }

  /**
   * Retrieves official package release metadata via `winget show <packageId>`
   */
  async showPackageMetadata(packageId: string): Promise<WinGetPackageDetails | null> {
    if (!SAFE_PACKAGE_ID_REGEX.test(packageId)) {
      throw new Error(`Invalid or unsafe package ID: ${packageId}`);
    }

    try {
      const { stdout } = await execFileAsync(
        this.wingetExecutable,
        ['show', packageId, '--accept-source-agreements'],
        { maxBuffer: 5 * 1024 * 1024 }
      );

      return this.parseShowOutput(packageId, stdout);
    } catch (err) {
      console.warn(`Could not fetch metadata for package ${packageId}:`, err);
      return null;
    }
  }

  /**
   * Parses the YAML-like output of `winget show`
   */
  parseShowOutput(packageId: string, output: string): WinGetPackageDetails {
    const details: WinGetPackageDetails = {
      packageId,
      name: packageId,
      version: 'unknown',
    };

    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      const foundMatch = line.match(/^Found\s+(.+)$/i);
      if (foundMatch) {
        details.name = foundMatch[1].trim();
        continue;
      }

      const match = line.match(/^\s*([A-Za-z0-9\s]+):\s*(.+)$/);
      if (!match) continue;

      const key = match[1].trim();
      const val = match[2].trim();

      switch (key.toLowerCase()) {
        case 'found':
          details.name = val;
          break;
        case 'version':
          if (details.version === 'unknown') details.version = val;
          break;
        case 'publisher':
          details.publisher = val;
          break;
        case 'publisher url':
          details.publisherUrl = val;
          break;
        case 'author':
          details.author = val;
          break;
        case 'description':
          details.description = val;
          break;
        case 'homepage':
          details.homepage = val;
          break;
        case 'license':
          details.license = val;
          break;
        case 'license url':
          details.licenseUrl = val;
          break;
        case 'release notes url':
          details.releaseNotesUrl = val;
          break;
        case 'installer type':
          details.installerType = val;
          break;
        case 'installer url':
          details.installerUrl = val;
          break;
        case 'installer sha256':
          details.sha256 = val;
          break;
        case 'release date':
          details.releaseDate = val;
          break;
      }
    }

    return details;
  }

  /**
   * Execute safe allowlisted package upgrade
   * Strictly adheres to Section 10 & 15:
   * - No shell string evaluation
   * - Validated package ID
   * - Accepts standard agreements
   * - No disabling of cryptographic hash/signature verification
   */
  async upgradePackage(packageId: string): Promise<UpgradeResult> {
    if (!SAFE_PACKAGE_ID_REGEX.test(packageId)) {
      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Package ID validation failed: "${packageId}" is not allowed.`,
        restartRequired: false,
        error: 'INVALID_PACKAGE_ID',
      };
    }

    const args = [
      'upgrade',
      '--id',
      packageId,
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ];

    try {
      const { stdout, stderr } = await execFileAsync(this.wingetExecutable, args, {
        timeout: 600000, // 10 minute timeout for large installers
        maxBuffer: 20 * 1024 * 1024,
      });

      return {
        success: true,
        exitCode: 0,
        stdout,
        stderr,
        restartRequired: stdout.includes('3010') || stdout.toLowerCase().includes('restart required'),
      };
    } catch (err: unknown) {
      const errorObj = err as { code?: number; stdout?: string; stderr?: string; message?: string };
      const exitCode = errorObj.code ?? 1;
      const stdout = errorObj.stdout ?? '';
      const stderr = errorObj.stderr ?? errorObj.message ?? '';

      // Exit code 3010 in Windows installer means SUCCESS_REBOOT_REQUIRED
      const restartRequired = exitCode === 3010 || stdout.includes('3010');

      return {
        success: exitCode === 0 || restartRequired,
        exitCode,
        stdout,
        stderr,
        restartRequired,
        error: exitCode !== 0 && !restartRequired ? `Process exited with code ${exitCode}` : undefined,
      };
    }
  }
}
