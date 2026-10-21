import {
  ApplicationEntity,
  DeviceEntity,
  ScanJobEntity,
  UpdateJobEntity,
  AuditEventEntity,
  ReleaseMetadataEntity,
  SecurityFindingEntity,
  ApplicationStatus,
  JobStatus,
} from '@updatepilot/shared';
import {
  IDeviceRepository,
  IApplicationRepository,
  IJobRepository,
  IAuditRepository,
  IReleaseMetadataRepository,
  ISecurityRepository,
} from './types';
import { SecurityAuth } from '../security/auth';

class MemoryStore {
  devices: Map<string, DeviceEntity> = new Map();
  credentials: Map<string, { deviceId: string; tokenHash: string; salt: string; isRevoked: boolean }> = new Map();
  applications: Map<string, ApplicationEntity> = new Map();
  scanJobs: Map<string, ScanJobEntity> = new Map();
  updateJobs: Map<string, UpdateJobEntity> = new Map();
  auditEvents: AuditEventEntity[] = [];
  metadata: Map<string, ReleaseMetadataEntity> = new Map();
  securityFindings: SecurityFindingEntity[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaultDev: DeviceEntity = {
      id: 'dev_win11_workstation_fixture',
      userId: 'usr_default_admin',
      deviceName: 'DESKTOP-WIN11-PRO (Dev Fixture)',
      osVersion: 'Windows 11 Pro 23H2 (Build 22631.3007)',
      osBuild: '22631.3007',
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.devices.set(defaultDev.id, defaultDev);

    const apps: ApplicationEntity[] = [
      {
        id: 'app_npp_01',
        deviceId: defaultDev.id,
        name: 'Notepad++ (64-bit x64)',
        packageId: 'Notepad++.Notepad++',
        publisher: 'Notepad++ Team',
        installedVersion: '8.8.3',
        availableVersion: '8.9.8.1',
        source: 'winget',
        status: 'UPDATE_AVAILABLE',
        lastScannedAt: new Date().toISOString(),
      },
      {
        id: 'app_firefox_02',
        deviceId: defaultDev.id,
        name: 'Mozilla Firefox (x64 en-US)',
        packageId: 'Mozilla.Firefox',
        publisher: 'Mozilla',
        installedVersion: '128.0',
        availableVersion: '128.0',
        source: 'winget',
        status: 'UP_TO_DATE',
        lastScannedAt: new Date().toISOString(),
      },
      {
        id: 'app_potplayer_03',
        deviceId: defaultDev.id,
        name: 'PotPlayer 64-bit',
        packageId: 'Daum.PotPlayer',
        publisher: 'Kakao Corp.',
        installedVersion: '25.06.25.0',
        availableVersion: '26.08.19.0',
        source: 'winget',
        status: 'UPDATE_AVAILABLE',
        lastScannedAt: new Date().toISOString(),
      },
      {
        id: 'app_internal_04',
        deviceId: defaultDev.id,
        name: 'Proprietary In-House Tool',
        packageId: null,
        publisher: 'Internal IT Corp',
        installedVersion: '1.0.4',
        availableVersion: null,
        source: 'local_registry',
        status: 'UNMATCHED',
        lastScannedAt: new Date().toISOString(),
      },
      {
        id: 'app_legacy_05',
        deviceId: defaultDev.id,
        name: 'Legacy Accounting DB Driver',
        packageId: null,
        publisher: 'LegacySoft',
        installedVersion: '2.1',
        availableVersion: null,
        source: 'arp',
        status: 'UNSUPPORTED',
        lastScannedAt: new Date().toISOString(),
      },
    ];

    for (const a of apps) {
      this.applications.set(a.id, a);
    }

    this.metadata.set('Notepad++.Notepad++', {
      packageId: 'Notepad++.Notepad++',
      latestVersion: '8.9.8.1',
      publisherUrl: 'https://notepad-plus-plus.org/',
      releaseNotesUrl: 'https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.8.1',
      license: 'GPL-3.0-or-later',
      installerType: 'wix',
      sha256: '0c4f4fe82babd7688f5c1431b1357392491563af6ffedf4e37f5de0bd71babb4',
      releaseDate: '2026-09-24',
    });

    this.securityFindings.push({
      id: 'sec_cve_01',
      packageId: 'Notepad++.Notepad++',
      cveId: 'CVE-2023-40031',
      summary: 'Buffer overflow vulnerability in earlier versions prior to 8.5.7',
      severity: 'MEDIUM',
      affectedVersions: '<8.5.7',
      fixedVersion: '8.5.7',
      advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2023-40031',
      publishedAt: '2023-09-01T00:00:00Z',
    });

    this.auditEvents.push({
      id: 'aud_init_01',
      userId: 'usr_default_admin',
      deviceId: defaultDev.id,
      eventType: 'SCAN_COMPLETED',
      action: 'Initial software scan completed',
      target: defaultDev.deviceName,
      metadata: { discoveredCount: 5, updatesCount: 2, isFixture: true },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    });
  }
}

const memoryStore = new MemoryStore();

export class MemoryDeviceRepository implements IDeviceRepository {
  async findById(id: string): Promise<DeviceEntity | null> {
    return memoryStore.devices.get(id) || null;
  }

  async findByPairingCode(code: string): Promise<DeviceEntity | null> {
    for (const dev of Array.from(memoryStore.devices.values())) {
      const devAny = dev as unknown as { pairingCode?: string; pairingCodeExpiresAt?: string };
      if (devAny.pairingCode === code) {
        if (devAny.pairingCodeExpiresAt && new Date(devAny.pairingCodeExpiresAt) > new Date()) {
          return dev;
        }
      }
    }
    return null;
  }

  async listByUserId(_userId: string): Promise<DeviceEntity[]> {
    return Array.from(memoryStore.devices.values());
  }

  async create(data: Omit<DeviceEntity, 'id' | 'createdAt'>): Promise<DeviceEntity> {
    const id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dev: DeviceEntity = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    memoryStore.devices.set(id, dev);
    return dev;
  }

  async update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity> {
    const existing = memoryStore.devices.get(id);
    if (!existing) throw new Error(`Device ${id} not found`);
    const updated = { ...existing, ...data };
    memoryStore.devices.set(id, updated);
    return updated;
  }

  async setPairingCode(id: string, code: string, expiresAt: Date): Promise<void> {
    const dev = memoryStore.devices.get(id);
    if (dev) {
      (dev as unknown as { pairingCode: string; pairingCodeExpiresAt: string }).pairingCode = code;
      (dev as unknown as { pairingCode: string; pairingCodeExpiresAt: string }).pairingCodeExpiresAt = expiresAt.toISOString();
    }
  }

  async createCredential(deviceId: string, tokenHash: string, salt: string): Promise<void> {
    memoryStore.credentials.set(deviceId, {
      deviceId,
      tokenHash,
      salt,
      isRevoked: false,
    });
  }

  async findCredentialByToken(token: string): Promise<{ deviceId: string; isRevoked: boolean } | null> {
    for (const cred of Array.from(memoryStore.credentials.values())) {
      if (SecurityAuth.verifyAgentToken(token, cred.tokenHash, cred.salt)) {
        return { deviceId: cred.deviceId, isRevoked: cred.isRevoked };
      }
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const dev = memoryStore.devices.get(id);
    if (dev) {
      dev.status = 'REVOKED';
      const cred = memoryStore.credentials.get(id);
      if (cred) cred.isRevoked = true;
    }
  }
}

export class MemoryApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<ApplicationEntity | null> {
    return memoryStore.applications.get(id) || null;
  }

  async findByPackageId(deviceId: string, packageId: string): Promise<ApplicationEntity | null> {
    for (const app of Array.from(memoryStore.applications.values())) {
      if (app.deviceId === deviceId && app.packageId?.toLowerCase() === packageId.toLowerCase()) {
        return app;
      }
    }
    return null;
  }

  async list(params: {
    deviceId?: string;
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number }> {
    let all = Array.from(memoryStore.applications.values());

    if (params.deviceId) {
      all = all.filter((a) => a.deviceId === params.deviceId);
    }

    if (params.status && params.status !== 'ALL') {
      all = all.filter((a) => a.status === params.status);
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      all = all.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.packageId?.toLowerCase().includes(q) ||
          a.publisher?.toLowerCase().includes(q)
      );
    }

    // Sort
    all.sort((a, b) => {
      const fieldA = (a[params.sortBy as keyof ApplicationEntity] || '').toString().toLowerCase();
      const fieldB = (b[params.sortBy as keyof ApplicationEntity] || '').toString().toLowerCase();
      if (params.sortOrder === 'desc') {
        return fieldB.localeCompare(fieldA);
      }
      return fieldA.localeCompare(fieldB);
    });

    const total = all.length;
    const start = (params.page - 1) * params.limit;
    const items = all.slice(start, start + params.limit);

    return { items, total };
  }

  async upsertMany(
    deviceId: string,
    apps: Array<{
      name: string;
      packageId?: string | null;
      publisher?: string | null;
      installedVersion: string;
      availableVersion?: string | null;
      source?: string | null;
      status: ApplicationStatus;
    }>
  ): Promise<number> {
    let saved = 0;
    for (const a of apps) {
      // Find matching existing application by name & deviceId
      let existing: ApplicationEntity | undefined;
      for (const item of Array.from(memoryStore.applications.values())) {
        if (item.deviceId === deviceId && (item.packageId === a.packageId || item.name === a.name)) {
          existing = item;
          break;
        }
      }

      if (existing) {
        existing.installedVersion = a.installedVersion;
        existing.availableVersion = a.availableVersion;
        existing.status = a.status;
        existing.source = a.source || existing.source;
        existing.lastScannedAt = new Date().toISOString();
      } else {
        const id = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        memoryStore.applications.set(id, {
          id,
          deviceId,
          name: a.name,
          packageId: a.packageId || null,
          publisher: a.publisher || null,
          installedVersion: a.installedVersion,
          availableVersion: a.availableVersion || null,
          source: a.source || 'winget',
          status: a.status,
          lastScannedAt: new Date().toISOString(),
        });
      }
      saved++;
    }
    return saved;
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    installedVersion?: string,
    availableVersion?: string | null
  ): Promise<ApplicationEntity> {
    const app = memoryStore.applications.get(id);
    if (!app) throw new Error(`Application ${id} not found`);
    app.status = status;
    if (installedVersion) app.installedVersion = installedVersion;
    if (availableVersion !== undefined) app.availableVersion = availableVersion;
    return app;
  }
}

export class MemoryJobRepository implements IJobRepository {
  async findScanJobById(id: string): Promise<ScanJobEntity | null> {
    return memoryStore.scanJobs.get(id) || null;
  }

  async findUpdateJobById(id: string): Promise<UpdateJobEntity | null> {
    return memoryStore.updateJobs.get(id) || null;
  }

  async createScanJob(deviceId: string): Promise<ScanJobEntity> {
    const id = `job_scan_${Date.now()}`;
    const job: ScanJobEntity = {
      id,
      deviceId,
      status: 'QUEUED',
      appsDiscovered: 0,
      updatesDetected: 0,
      createdAt: new Date().toISOString(),
    };
    memoryStore.scanJobs.set(id, job);
    return job;
  }

  async createUpdateJob(data: {
    deviceId: string;
    applicationId: string;
    packageId: string;
    currentVersion: string;
    targetVersion: string;
  }): Promise<UpdateJobEntity> {
    const id = `job_upd_${Date.now()}`;
    const job: UpdateJobEntity = {
      id,
      ...data,
      status: 'QUEUED',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    memoryStore.updateJobs.set(id, job);
    return job;
  }

  async pollPendingJob(deviceId: string): Promise<{ id: string; type: 'SCAN' | 'UPDATE'; payload: any } | null> {
    // Check update jobs first
    for (const job of Array.from(memoryStore.updateJobs.values())) {
      if (job.deviceId === deviceId && job.status === 'QUEUED') {
        return {
          id: job.id,
          type: 'UPDATE',
          payload: {
            applicationId: job.applicationId,
            packageId: job.packageId,
            currentVersion: job.currentVersion,
            targetVersion: job.targetVersion,
          },
        };
      }
    }

    // Then check scan jobs
    for (const job of Array.from(memoryStore.scanJobs.values())) {
      if (job.deviceId === deviceId && job.status === 'QUEUED') {
        return {
          id: job.id,
          type: 'SCAN',
          payload: {},
        };
      }
    }

    return null;
  }

  async claimJob(id: string, type: 'SCAN' | 'UPDATE'): Promise<boolean> {
    if (type === 'UPDATE') {
      const job = memoryStore.updateJobs.get(id);
      if (job && job.status === 'QUEUED') {
        job.status = 'CLAIMED';
        job.startedAt = new Date().toISOString();
        return true;
      }
    } else {
      const job = memoryStore.scanJobs.get(id);
      if (job && job.status === 'QUEUED') {
        job.status = 'CLAIMED';
        job.startedAt = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  async updateScanJob(id: string, data: Partial<ScanJobEntity>): Promise<void> {
    const job = memoryStore.scanJobs.get(id);
    if (job) {
      Object.assign(job, data);
    }
  }

  async updateUpdateJob(id: string, data: Partial<UpdateJobEntity>): Promise<void> {
    const job = memoryStore.updateJobs.get(id);
    if (job) {
      Object.assign(job, data);
    }
  }

  async listRecentJobs(limit: number): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>> {
    const list: Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }> = [];

    for (const u of memoryStore.updateJobs.values()) {
      list.push({
        id: u.id,
        type: 'UPDATE',
        title: `Update ${u.packageId} (${u.currentVersion} → ${u.targetVersion})`,
        status: u.status,
        timestamp: u.createdAt,
        details: u.verificationDetails || u.executionOutput || undefined,
      });
    }

    for (const s of memoryStore.scanJobs.values()) {
      list.push({
        id: s.id,
        type: 'SCAN',
        title: `Host Software Inventory Scan`,
        status: s.status,
        timestamp: s.createdAt,
        details: s.errorDetails || `${s.appsDiscovered} apps discovered`,
      });
    }

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, limit);
  }

  async listUpdateHistory(page: number, limit: number): Promise<{ items: UpdateJobEntity[]; total: number }> {
    const all = Array.from(memoryStore.updateJobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const total = all.length;
    const start = (page - 1) * limit;
    return { items: all.slice(start, start + limit), total };
  }
}

export class MemoryAuditRepository implements IAuditRepository {
  async record(event: Omit<AuditEventEntity, 'id' | 'createdAt'>): Promise<void> {
    const e: AuditEventEntity = {
      ...event,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    memoryStore.auditEvents.unshift(e);
  }

  async list(limit: number): Promise<AuditEventEntity[]> {
    return memoryStore.auditEvents.slice(0, limit);
  }
}

export class MemoryReleaseMetadataRepository implements IReleaseMetadataRepository {
  async findByPackageId(packageId: string): Promise<ReleaseMetadataEntity | null> {
    return memoryStore.metadata.get(packageId) || null;
  }

  async upsert(metadata: ReleaseMetadataEntity): Promise<void> {
    memoryStore.metadata.set(metadata.packageId, metadata);
  }
}

export class MemorySecurityRepository implements ISecurityRepository {
  async listByPackageId(packageId: string): Promise<SecurityFindingEntity[]> {
    return memoryStore.securityFindings.filter((f) => f.packageId.toLowerCase() === packageId.toLowerCase());
  }

  async listAll(): Promise<SecurityFindingEntity[]> {
    return memoryStore.securityFindings;
  }
}
