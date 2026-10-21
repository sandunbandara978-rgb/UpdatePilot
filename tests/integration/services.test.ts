import { describe, it, expect, beforeEach } from 'vitest';
import { deviceService } from '../../apps/web/src/server/services/deviceService';
import { applicationService } from '../../apps/web/src/server/services/applicationService';
import { updateService } from '../../apps/web/src/server/services/updateService';
import { jobService } from '../../apps/web/src/server/services/jobService';

describe('UpdatePilot End-to-End Service Integration', () => {
  let agentToken: string;
  let deviceId: string;

  it('1. Generates one-time pairing code and pairs agent successfully', async () => {
    const { pairingCode, expiresAt } = await deviceService.generatePairingCode('usr_admin_test');
    expect(pairingCode).toMatch(/^UP-\d{6}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Agent pairs with the code
    const pairResult = await deviceService.pairDevice({
      pairingCode,
      deviceName: 'WIN-TEST-NODE',
      osVersion: 'Windows 11 23H2',
      agentVersion: '1.0.0',
    });

    expect(pairResult.deviceId).toBeDefined();
    expect(pairResult.token).toMatch(/^agt_/);
    expect(pairResult.pollingIntervalSec).toBe(15);

    agentToken = pairResult.token;
    deviceId = pairResult.deviceId;
  });

  it('2. Dispatches heartbeat and authenticates agent Bearer token', async () => {
    const heartbeatRes = await deviceService.handleHeartbeat(agentToken, {
      status: 'ONLINE',
      agentVersion: '1.0.0',
    });
    expect(heartbeatRes.acknowledged).toBe(true);

    // Invalid token must be rejected
    await expect(deviceService.handleHeartbeat('invalid_token', {})).rejects.toThrow();
  });

  it('3. Submits software discovery scan and updates inventory accurately', async () => {
    const scanApps = [
      {
        name: 'Notepad++ (64-bit x64)',
        packageId: 'Notepad++.Notepad++',
        publisher: 'Notepad++ Team',
        installedVersion: '8.8.3',
        availableVersion: '8.9.8.1',
        source: 'winget',
      },
      {
        name: 'Mozilla Firefox',
        packageId: 'Mozilla.Firefox',
        publisher: 'Mozilla',
        installedVersion: '128.0',
        availableVersion: '128.0',
        source: 'winget',
      },
    ];

    const result = await applicationService.submitScanResults(agentToken, 'scan_test_01', scanApps);
    expect(result.appsSaved).toBe(2);
    expect(result.updatesCount).toBe(1);

    // Check inventory
    const inventory = await applicationService.listApplications({
      deviceId,
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(inventory.total).toBe(2);
    const npp = inventory.items.find((i) => i.name.includes('Notepad++'));
    expect(npp?.status).toBe('UPDATE_AVAILABLE');
    const ff = inventory.items.find((i) => i.name.includes('Firefox'));
    expect(ff?.status).toBe('UP_TO_DATE');
  });

  it('4. Previews update and catches version mismatch', async () => {
    const apps = await applicationService.listApplications({
      deviceId,
      status: 'UPDATE_AVAILABLE',
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    const targetApp = apps.items[0];
    expect(targetApp).toBeDefined();

    const preview = await updateService.previewUpdate(targetApp.id);
    expect(preview.targetVersion).toBe('8.9.8.1');
    expect(preview.isAllowlisted).toBe(true);

    // Attempting to execute with wrong version must fail
    await expect(
      updateService.executeUpdate({
        applicationId: targetApp.id,
        acknowledgedTargetVersion: '9.9.9', // Mismatched version
        userId: 'usr_admin_test',
      })
    ).rejects.toThrow(/Version mismatch/);
  });

  it('5. Executes confirmed update, agent claims job, and verifies completion', async () => {
    const apps = await applicationService.listApplications({
      deviceId,
      status: 'UPDATE_AVAILABLE',
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    const targetApp = apps.items[0];

    // User confirms update
    const job = await updateService.executeUpdate({
      applicationId: targetApp.id,
      acknowledgedTargetVersion: '8.9.8.1',
      userId: 'usr_admin_test',
    });

    expect(job.status).toBe('QUEUED');
    expect(job.targetVersion).toBe('8.9.8.1');

    // Agent polls for jobs
    const pollRes = await jobService.pollJobForAgent(agentToken);
    expect(pollRes?.id).toBe(job.id);
    expect(pollRes?.type).toBe('UPDATE');

    // Agent claims job
    const claimRes = await jobService.claimJobByAgent(agentToken, job.id);
    expect(claimRes.claimed).toBe(true);

    // Agent reports verification and completion
    const reportRes = await jobService.reportJobByAgent(agentToken, job.id, {
      status: 'COMPLETED',
      exitCode: 0,
      verifiedVersion: '8.9.8.1',
      logs: 'Installer finished with exit code 0. Post-update inspection verified version 8.9.8.1.',
    });

    expect(reportRes.acknowledged).toBe(true);

    // Verify application status changed to UP_TO_DATE
    const updatedApp = await applicationService.getApplicationDetails(targetApp.id);
    expect(updatedApp?.application.status).toBe('UP_TO_DATE');
    expect(updatedApp?.application.installedVersion).toBe('8.9.8.1');
  });
});
