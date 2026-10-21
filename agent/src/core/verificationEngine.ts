import { WinGetAdapter } from '../adapters/wingetAdapter';

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

      // Clean version comparisons
      const cleanInstalled = installedVer.trim().replace(/^v/i, '');
      const cleanExpected = expectedTargetVersion.trim().replace(/^v/i, '');

      if (cleanInstalled === cleanExpected || cleanInstalled.startsWith(cleanExpected) || cleanExpected.startsWith(cleanInstalled)) {
        return {
          verified: true,
          actualInstalledVersion: installedVer,
          expectedTargetVersion,
          details: `Verification successful: Installed version matches target version (${installedVer}).`,
        };
      }

      return {
        verified: false,
        actualInstalledVersion: installedVer,
        expectedTargetVersion,
        details: `Verification failed: Detected installed version (${installedVer}) does not match expected target version (${expectedTargetVersion}).`,
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
