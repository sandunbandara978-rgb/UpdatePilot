import { describe, it, expect, beforeEach } from 'vitest';
import { memoryStore, MemoryDeviceRepository, MemoryApplicationRepository } from '../../apps/web/src/server/repositories/memoryStore';
import { jobService } from '../../apps/web/src/server/services/jobService';

describe('Fleet Multi-Computer & Persistence Integrity', () => {
  const deviceRepo = new MemoryDeviceRepository();
  const appRepo = new MemoryApplicationRepository();

  beforeEach(() => {
    // Reset to demo fixture for test consistency
    memoryStore.restoreDemoFixture();
  });

  it('allows adding real multi-computer fleet devices', async () => {
    const pc1 = await deviceRepo.create({
      userId: 'usr_default_admin',
      deviceName: 'WORKSTATION-ALPHA',
      osVersion: 'Windows 11 Pro 23H2 (x64)',
      agentVersion: '1.0.0-pwsh',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    const pc2 = await deviceRepo.create({
      userId: 'usr_default_admin',
      deviceName: 'LAPTOP-BETA',
      osVersion: 'Windows 10 Enterprise (x64)',
      agentVersion: '1.0.0-pwsh',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    const allDevices = await deviceRepo.listByUserId('usr_default_admin');
    const deviceNames = allDevices.map((d) => d.deviceName);

    expect(deviceNames).toContain('WORKSTATION-ALPHA');
    expect(deviceNames).toContain('LAPTOP-BETA');
  });

  it('correctly filters dashboard metrics by specific computer', async () => {
    const pc = await deviceRepo.create({
      userId: 'usr_default_admin',
      deviceName: 'DEV-MACHINE-01',
      osVersion: 'Windows 11 Pro',
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    await appRepo.upsertMany(pc.id, [
      {
        name: 'Custom Internal Tool',
        packageId: 'Internal.Tool',
        installedVersion: '1.0.0',
        availableVersion: '2.0.0',
        status: 'UPDATE_AVAILABLE',
      },
    ]);

    // Check filtered metrics for DEV-MACHINE-01
    const metricsForDev = await jobService.getDashboardMetrics(pc.id);
    expect(metricsForDev.totalApplications).toBe(1);
    expect(metricsForDev.updatesAvailable).toBe(1);

    // Check all metrics includes all
    const allMetrics = await jobService.getDashboardMetrics('ALL');
    expect(allMetrics.totalApplications).toBeGreaterThanOrEqual(1);
  });

  it('supports clearing demo fixture when real host data is populated', async () => {
    expect(memoryStore.devices.has('dev_win11_workstation_fixture')).toBe(true);
    const cleared = memoryStore.clearDemoFixture();
    expect(cleared).toBe(true);
    expect(memoryStore.devices.has('dev_win11_workstation_fixture')).toBe(false);

    // Verify fixture apps were also removed
    const apps = Array.from(memoryStore.applications.values());
    const fixtureApps = apps.filter((a) => a.deviceId === 'dev_win11_workstation_fixture');
    expect(fixtureApps.length).toBe(0);
  });
});
