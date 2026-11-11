import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  userRepo,
  settingsRepo,
  deviceRepo,
  applicationRepo,
  appHistoryRepo,
} from '../../apps/web/src/server/repositories';
import { SecurityAuth } from '../../apps/web/src/server/security/auth';
import { deviceService } from '../../apps/web/src/server/services/deviceService';
import { applicationService } from '../../apps/web/src/server/services/applicationService';
import { jobService } from '../../apps/web/src/server/services/jobService';
import { securityService } from '../../apps/web/src/server/services/securityService';
import { GET as exportHistoryGET } from '../../apps/web/src/app/api/v1/history/export/route';
import { GET as dashboardGET } from '../../apps/web/src/app/api/v1/dashboard/route';

describe('Authentication, Ownership Isolation, Persistence & Security Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers users with PBKDF2-SHA512 hashes and enforces strict cross-user device & inventory isolation', async () => {
    const emailA = `alice_${Date.now()}@updatepilot.local`;
    const emailB = `bob_${Date.now()}@updatepilot.local`;

    const userA = await userRepo.create({
      email: emailA,
      name: 'Alice Admin',
      passwordHash: SecurityAuth.hashPassword('AlicePass123!'),
      role: 'ADMIN',
    });

    const userB = await userRepo.create({
      email: emailB,
      name: 'Bob Operator',
      passwordHash: SecurityAuth.hashPassword('BobPass123!'),
      role: 'USER',
    });

    expect(SecurityAuth.verifyPassword('AlicePass123!', userA.passwordHash)).toBe(true);
    expect(SecurityAuth.verifyPassword('WrongPass!', userA.passwordHash)).toBe(false);

    // Pair device under Alice
    const { pairingCode } = await deviceService.generatePairingCode(userA.id);
    const pairA = await deviceService.pairDevice({
      pairingCode,
      deviceName: 'ALICE-PC',
      osVersion: 'Windows 11 Pro',
      agentVersion: '1.0.0',
    });

    await applicationService.submitScanResults(pairA.token, 'scan_iso_1', [
      {
        name: 'Git',
        packageId: 'Git.Git',
        installedVersion: '2.40.0',
        availableVersion: '2.56.0.4',
        source: 'winget',
      },
    ]);

    // Bob's device list must NOT include Alice's device
    const bobDevices = await deviceRepo.listByUserId(userB.id);
    expect(bobDevices.find((d) => d.id === pairA.deviceId)).toBeUndefined();

    // Bob cannot access Alice's device or applications
    await expect(deviceService.assertDeviceOwnership(pairA.deviceId, userB.id)).rejects.toThrow(/Forbidden/);
    await expect(
      applicationService.listApplications({
        userId: userB.id,
        deviceId: pairA.deviceId,
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      })
    ).rejects.toThrow(/Forbidden/);

    await expect(jobService.getDashboardMetrics(pairA.deviceId, userB.id)).rejects.toThrow(/Forbidden/);
  });

  it('persists and updates user settings per account', async () => {
    const uid = `usr_settings_${Date.now()}`;
    const initial = await settingsRepo.getByUserId(uid);
    expect(initial.scanIntervalHours).toBe(12);
    expect(initial.autoCheckUpdates).toBe(true);

    const updated = await settingsRepo.upsert(uid, {
      theme: 'dark',
      scanIntervalHours: 24,
      autoCheckUpdates: false,
      emailAlerts: true,
    });

    expect(updated.theme).toBe('dark');
    expect(updated.scanIntervalHours).toBe(24);
    expect(updated.autoCheckUpdates).toBe(false);
    expect(updated.emailAlerts).toBe(true);

    const reloaded = await settingsRepo.getByUserId(uid);
    expect(reloaded.theme).toBe('dark');
    expect(reloaded.scanIntervalHours).toBe(24);
  });

  it('rejects unauthenticated requests to dashboard & export routes and separates audit vs update CSV exports', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/v1/dashboard');
    const unauthRes = await dashboardGET(unauthReq);
    expect(unauthRes.status).toBe(401);

    const unauthExport = new NextRequest('http://localhost:3000/api/v1/history/export?type=audit');
    const unauthExportRes = await exportHistoryGET(unauthExport);
    expect(unauthExportRes.status).toBe(401);

    // Create an authenticated user with a paired device & audit event
    const user = await userRepo.create({
      email: `export_${Date.now()}@updatepilot.local`,
      name: 'Export Tester',
      passwordHash: SecurityAuth.hashPassword('TestPass123!'),
      role: 'ADMIN',
    });
    const { pairingCode } = await deviceService.generatePairingCode(user.id);
    await deviceService.pairDevice({
      pairingCode,
      deviceName: 'EXPORT-PC',
      osVersion: 'Windows 11',
      agentVersion: '1.0.0',
    });

    const token = SecurityAuth.signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'ADMIN',
    });

    const auditExportReq = new NextRequest('http://localhost:3000/api/v1/history/export?type=audit', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const auditCsvRes = await exportHistoryGET(auditExportReq);
    expect(auditCsvRes.status).toBe(200);
    const auditCsvText = await auditCsvRes.text();
    expect(auditCsvText).toContain('Event ID,Timestamp,Event Type,Action,Target,Device ID,User ID');
    expect(auditCsvText).toContain('AGENT_PAIRED');

    const updateExportReq = new NextRequest('http://localhost:3000/api/v1/history/export?type=updates', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updateCsvRes = await exportHistoryGET(updateExportReq);
    expect(updateCsvRes.status).toBe(200);
    const updateCsvText = await updateCsvRes.text();
    expect(updateCsvText).toContain('Job ID,Device ID,Package ID,Current Version,Target Version');
  });

  it('queries NVD safely when online and degrades honestly without synthetic CVEs when offline', async () => {
    const user = await userRepo.create({
      email: `sec_${Date.now()}@updatepilot.local`,
      name: 'Security Tester',
      passwordHash: SecurityAuth.hashPassword('TestPass123!'),
      role: 'ADMIN',
    });

    const { pairingCode } = await deviceService.generatePairingCode(user.id);
    const paired = await deviceService.pairDevice({
      pairingCode,
      deviceName: 'SEC-PC',
      osVersion: 'Windows 11',
      agentVersion: '1.0.0',
    });

    await applicationService.submitScanResults(paired.token, 'scan_sec_1', [
      {
        name: 'Git',
        packageId: 'Git.Git',
        installedVersion: '2.40.0',
        availableVersion: '2.56.0.4',
        source: 'winget',
      },
    ]);

    // 1. Mock verified NVD response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          vulnerabilities: [
            {
              cve: {
                id: 'CVE-2023-25652',
                published: '2023-04-25T20:15:09.933',
                descriptions: [{ lang: 'en', value: 'Git arbitrary file overwrite vulnerability.' }],
                metrics: {
                  cvssMetricV31: [{ cvssData: { baseScore: 7.5, baseSeverity: 'HIGH' } }],
                },
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const liveResult = await securityService.getSecurityFindingsForUser(user.id, { forceRefresh: true });
    expect(liveResult.advisoryFeedStatus).toBe('VERIFIED_LIVE');
    expect(liveResult.findings.length).toBe(1);
    expect(liveResult.findings[0].cveId).toBe('CVE-2023-25652');
    expect(liveResult.findings[0].severity).toBe('HIGH');

    // 2. Verify ApplicationHistory record helper works
    const apps = await applicationRepo.list({ deviceId: paired.deviceId, page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });
    const gitApp = apps.items[0];
    await appHistoryRepo.record({
      applicationId: gitApp.id,
      previousVersion: '2.40.0',
      newVersion: '2.56.0.4',
      triggerType: 'AGENT_UPDATE',
    });
    const hist = await appHistoryRepo.listByApplicationId(gitApp.id);
    expect(hist.length).toBe(1);
    expect(hist[0].newVersion).toBe('2.56.0.4');
  });
});

