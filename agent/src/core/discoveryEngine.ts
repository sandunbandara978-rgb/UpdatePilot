import { WinGetAdapter, WinGetApp } from '../adapters/wingetAdapter';

export interface DiscoveredInventoryApp {
  name: string;
  packageId?: string;
  publisher?: string;
  installedVersion: string;
  availableVersion?: string;
  source?: string;
}

export class DiscoveryEngine {
  private wingetAdapter: WinGetAdapter;

  constructor(wingetAdapter?: WinGetAdapter) {
    this.wingetAdapter = wingetAdapter || new WinGetAdapter();
  }

  async runDiscovery(): Promise<DiscoveredInventoryApp[]> {
    const availability = await this.wingetAdapter.checkAvailability();
    if (!availability.available) {
      throw new Error(`WinGet is not available on this host: ${availability.error}`);
    }

    const rawApps = await this.wingetAdapter.listInstalledApps();

    return rawApps.map((app: WinGetApp) => ({
      name: app.name,
      packageId: app.packageId,
      installedVersion: app.version,
      availableVersion: app.availableVersion,
      source: app.source,
    }));
  }
}
