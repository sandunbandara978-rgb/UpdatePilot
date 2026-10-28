import { WinGetAdapter } from '../adapters/wingetAdapter';
import { compareVersions } from '@updatepilot/shared';

export interface VerificationResult {
  verified: boolean;
  actualInstalledVersion?: string;
  expectedTargetVersion: string;
  details: string;
}

export class VerificationEngine {
  private wingetAdapter: WinGetAdapter;

  constructor(wingetAdapter?: WinGetAdapter) {
    this.wingetAdapter = wingetAdapter || new WinGetAdapter();
  }

  /**
   * Performs rigorous post-install verification by querying the installed inventory
   * for the specific package ID.
   *
   * Safety Rules:
   * 1. Re-scans installed inventory using WinGet/ARP.
   * 2. Evaluates version equality with multi-part SemVer/Windows version comparator.
   * 3. Rejects unsafe string-prefix matches (e.g. '1.0' != '1.0.1').
   * 4. Refuses to substitute target version for missing or mismatched results.
   */
  async verifyUpgrade(packageId: string, expectedTargetVersion: string): Promise<VerificationResult> {
    try {
      // Re-scan installed software to find the current version of the package
      const installedApps = await this.wingetAdapter.listInstalledApps();
      const matchedApp = installedApps.find((app) => app.packageId?.toLowerCase() === packageId.toLowerCase());

      if (!matchedApp) {
        return {
          verified: false,
          expectedTargetVersion,
          details: `Package "${packageId}" could not be located in installed inventory after upgrade execution.`,
        };
      }

      const installedVer = matchedApp.version;
      const comparison = compareVersions(installedVer, expectedTargetVersion);

      if (comparison === 0) {
        return {
          verified: true,
          actualInstalledVersion: installedVer,
          expectedTargetVersion,
          details: `Verification successful: Installed version matches approved target version (${installedVer}).`,
        };
      }

      return {
        verified: false,
        actualInstalledVersion: installedVer,
        expectedTargetVersion,
        details: `Verification failed: Detected installed version (${installedVer}) does not match approved target version (${expectedTargetVersion}).`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        verified: false,
        expectedTargetVersion,
        details: `Verification inspection encountered an exception: ${msg}`,
      };
    }
  }
}
