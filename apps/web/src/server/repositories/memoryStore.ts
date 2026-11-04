import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

function getStoragePath(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return path.join(os.tmpdir(), `updatepilot-test-storage-${process.pid}.json`);
  }
  const cwd = process.cwd();
  let root = cwd;
  // If cwd is apps/web, walk up to monorepo root
  if (fs.existsSync(path.resolve(cwd, '..', '..', 'data'))) {
    root = path.resolve(cwd, '..', '..');
  } else if (fs.existsSync(path.resolve(cwd, '..', '..', 'package.json'))) {
    root = path.resolve(cwd, '..', '..');
  }
  const dir = path.resolve(root, 'data');
  return path.join(dir, 'updatepilot-storage.json');
}

export class MemoryStore {
  devices: Map<string, DeviceEntity> = new Map();
  credentials: Map<string, { deviceId: string; tokenHash: string; salt: string; isRevoked: boolean }> = new Map();
  applications: Map<string, ApplicationEntity> = new Map();
  scanJobs: Map<string, ScanJobEntity> = new Map();
  updateJobs: Map<string, UpdateJobEntity> = new Map();
  auditEvents: AuditEventEntity[] = [];
  metadata: Map<string, ReleaseMetadataEntity> = new Map();
  securityFindings: SecurityFindingEntity[] = [];

  constructor() {
    this.loadFromDisk();
  }

  saveToDisk(): void {
    try {
      const storageFile = getStoragePath();
      const dir = path.dirname(storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serialized = {
        devices: Array.from(this.devices.entries()),
        credentials: Array.from(this.credentials.entries()),
        applications: Array.from(this.applications.entries()),
        scanJobs: Array.from(this.scanJobs.entries()),
        updateJobs: Array.from(this.updateJobs.entries()),
        auditEvents: this.auditEvents,
        metadata: Array.from(this.metadata.entries()),
        securityFindings: this.securityFindings,
      };
      fs.writeFileSync(storageFile, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (err) {
      console.warn('MemoryStore could not persist to disk:', err);
    }
  }

  loadFromDisk(): void {
    try {
      const storageFile = getStoragePath();
      if (fs.existsSync(storageFile)) {
        const raw = fs.readFileSync(storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.devices) this.devices = new Map(data.devices);
        if (data.credentials) this.credentials = new Map(data.credentials);
        if (data.applications) this.applications = new Map(data.applications);
        if (data.scanJobs) this.scanJobs = new Map(data.scanJobs);
        if (data.updateJobs) this.updateJobs = new Map(data.updateJobs);
        if (data.auditEvents) this.auditEvents = data.auditEvents;
        if (data.metadata) this.metadata = new Map(data.metadata);
        if (data.securityFindings) this.securityFindings = data.securityFindings;
        return;
      }
    } catch (err) {
      console.warn('MemoryStore failed to read storage, initializing defaults:', err);
    }
    this.seedDefaults();
    this.saveToDisk();
  }

  purgeAllMockAndDemoDevices(keepDeviceId?: string): { removedDevices: number; removedApps: number } {
    let targetDeviceId = keepDeviceId;
    if (!targetDeviceId) {
      const localHostName = os.hostname().toLowerCase();
      // Find non-fixture device matching current host, or most recently active device
      for (const dev of Array.from(this.devices.values())) {
        if (dev.id !== 'dev_win11_workstation_fixture' && dev.deviceName.toLowerCase().includes(localHostName)) {
          targetDeviceId = dev.id;
          break;
        }
      }
      if (!targetDeviceId) {
        for (const dev of Array.from(this.devices.values())) {
          if (dev.id !== 'dev_win11_workstation_fixture') {
            targetDeviceId = dev.id;
            break;
          }
        }
      }
    }

    let removedDevices = 0;
    let removedApps = 0;

    for (const [id] of Array.from(this.devices.entries())) {
      if (id !== targetDeviceId) {
        this.devices.delete(id);
        removedDevices++;
      }
    }

    for (const [id, app] of Array.from(this.applications.entries())) {
      if (app.deviceId !== targetDeviceId) {
        this.applications.delete(id);
        removedApps++;
      }
    }

    for (const [id, job] of Array.from(this.updateJobs.entries())) {
      if (job.deviceId !== targetDeviceId) {
        this.updateJobs.delete(id);
      }
    }

    for (const [id, scan] of Array.from(this.scanJobs.entries())) {
      if (scan.deviceId !== targetDeviceId) {
        this.scanJobs.delete(id);
      }
    }

    for (const [token, cred] of Array.from(this.credentials.entries())) {
      if (cred.deviceId !== targetDeviceId) {
        this.credentials.delete(token);
      }
    }

    if (targetDeviceId) {
      this.auditEvents = this.auditEvents.filter((e) => e.deviceId === targetDeviceId);
    }

    this.saveToDisk();
    return { removedDevices, removedApps };
  }

  clearDemoFixture(): boolean {
    const res = this.purgeAllMockAndDemoDevices();
    return res.removedDevices > 0 || res.removedApps > 0;
  }

  restoreDemoFixture(): void {
    const fixtureDev: DeviceEntity = {
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
    this.devices.set(fixtureDev.id, fixtureDev);
    this.saveToDisk();
  }

  private seedDefaults(): void {
    const hostname = os.hostname();
    const osVersion = `${os.type()} ${os.release()} (${os.arch()})`;
    const hostDeviceId = `dev_${hostname.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const hostDev: DeviceEntity = {
      id: hostDeviceId,
      userId: 'usr_default_admin',
      deviceName: hostname,
      osVersion,
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.devices.set(hostDev.id, hostDev);
  }
}

export const memoryStore = new MemoryStore();

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
    memoryStore.saveToDisk();
    return dev;
  }

  async update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity> {
    const existing = memoryStore.devices.get(id);
    if (!existing) throw new Error(`Device ${id} not found`);
    const updated = { ...existing, ...data };
    memoryStore.devices.set(id, updated);
    memoryStore.saveToDisk();
    return updated;
  }

  async setPairingCode(id: string, code: string, expiresAt: Date): Promise<void> {
    const dev = memoryStore.devices.get(id);
    if (dev) {
      (dev as unknown as { pairingCode: string; pairingCodeExpiresAt: string }).pairingCode = code;
      (dev as unknown as { pairingCode: string; pairingCodeExpiresAt: string }).pairingCodeExpiresAt = expiresAt.toISOString();
      memoryStore.saveToDisk();
    }
  }

  async createCredential(deviceId: string, tokenHash: string, salt: string): Promise<void> {
    memoryStore.credentials.set(deviceId, {
      deviceId,
      tokenHash,
      salt,
      isRevoked: false,
    });
    memoryStore.saveToDisk();
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
      memoryStore.saveToDisk();
    }
  }

  async delete(id: string): Promise<void> {
    memoryStore.devices.delete(id);
    for (const [appId, app] of Array.from(memoryStore.applications.entries())) {
      if (app.deviceId === id) {
        memoryStore.applications.delete(appId);
      }
    }
    memoryStore.saveToDisk();
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
    // If saving apps for a real device, clean out the fixture to prevent confusion
    if (deviceId !== 'dev_win11_workstation_fixture' && memoryStore.devices.has('dev_win11_workstation_fixture')) {
      memoryStore.clearDemoFixture();
    }

    let saved = 0;
    for (const a of apps) {
      let existing: ApplicationEntity | undefined;
      for (const item of Array.from(memoryStore.applications.values())) {
        const pkgMatch = Boolean(a.packageId && item.packageId && item.packageId.toLowerCase() === a.packageId.toLowerCase());
        const nameMatch = Boolean(item.name.toLowerCase() === a.name.toLowerCase());
        if (item.deviceId === deviceId && (pkgMatch || nameMatch)) {
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
    memoryStore.saveToDisk();
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
    memoryStore.saveToDisk();
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
    memoryStore.saveToDisk();
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
    memoryStore.saveToDisk();
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

  async claimJob(id: string, type: 'SCAN' | 'UPDATE', deviceId?: string): Promise<boolean> {
    if (type === 'UPDATE') {
      const job = memoryStore.updateJobs.get(id);
      if (job && job.status === 'QUEUED') {
        if (deviceId && job.deviceId !== deviceId) {
          return false;
        }
        job.status = 'CLAIMED';
        job.startedAt = new Date().toISOString();
        memoryStore.saveToDisk();
        return true;
      }
    } else {
      const job = memoryStore.scanJobs.get(id);
      if (job && job.status === 'QUEUED') {
        if (deviceId && job.deviceId !== deviceId) {
          return false;
        }
        job.status = 'CLAIMED';
        job.startedAt = new Date().toISOString();
        memoryStore.saveToDisk();
        return true;
      }
    }
    return false;
  }

  async updateScanJob(id: string, data: Partial<ScanJobEntity>): Promise<void> {
    const job = memoryStore.scanJobs.get(id);
    if (job) {
      Object.assign(job, data);
      memoryStore.saveToDisk();
    }
  }

  async updateUpdateJob(id: string, data: Partial<UpdateJobEntity>): Promise<void> {
    const job = memoryStore.updateJobs.get(id);
    if (job) {
      Object.assign(job, data);
      memoryStore.saveToDisk();
    }
  }

  async listRecentJobs(limit: number): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>> {
    const list: Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }> = [];

    for (const u of memoryStore.updateJobs.values()) {
      list.push({
        id: u.id,
        type: 'UPDATE',
        title: `Update ${u.packageId} (${u.currentVersion} â†’ ${u.targetVersion})`,
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
    memoryStore.saveToDisk();
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
    memoryStore.saveToDisk();
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
