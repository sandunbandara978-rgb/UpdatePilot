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

export interface IDeviceRepository {
  findById(id: string): Promise<DeviceEntity | null>;
  findByPairingCode(code: string): Promise<DeviceEntity | null>;
  listByUserId(userId: string): Promise<DeviceEntity[]>;
  create(data: Omit<DeviceEntity, 'id' | 'createdAt'>): Promise<DeviceEntity>;
  update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity>;
  setPairingCode(id: string, code: string, expiresAt: Date): Promise<void>;
  createCredential(deviceId: string, tokenHash: string, salt: string): Promise<void>;
  findCredentialByToken(token: string): Promise<{ deviceId: string; isRevoked: boolean } | null>;
  revoke(id: string): Promise<void>;
}

export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationEntity | null>;
  findByPackageId(deviceId: string, packageId: string): Promise<ApplicationEntity | null>;
  list(params: {
    deviceId?: string;
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number }>;
  upsertMany(
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
  ): Promise<number>;
  updateStatus(id: string, status: ApplicationStatus, installedVersion?: string, availableVersion?: string | null): Promise<ApplicationEntity>;
}

export interface IJobRepository {
  findScanJobById(id: string): Promise<ScanJobEntity | null>;
  findUpdateJobById(id: string): Promise<UpdateJobEntity | null>;
  createScanJob(deviceId: string): Promise<ScanJobEntity>;
  createUpdateJob(data: {
    deviceId: string;
    applicationId: string;
    packageId: string;
    currentVersion: string;
    targetVersion: string;
  }): Promise<UpdateJobEntity>;
  pollPendingJob(deviceId: string): Promise<{ id: string; type: 'SCAN' | 'UPDATE'; payload: any } | null>;
  claimJob(id: string, type: 'SCAN' | 'UPDATE'): Promise<boolean>;
  updateScanJob(id: string, data: Partial<ScanJobEntity>): Promise<void>;
  updateUpdateJob(id: string, data: Partial<UpdateJobEntity>): Promise<void>;
  listRecentJobs(limit: number): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>>;
  listUpdateHistory(page: number, limit: number): Promise<{ items: UpdateJobEntity[]; total: number }>;
}

export interface IAuditRepository {
  record(event: Omit<AuditEventEntity, 'id' | 'createdAt'>): Promise<void>;
  list(limit: number): Promise<AuditEventEntity[]>;
}

export interface IReleaseMetadataRepository {
  findByPackageId(packageId: string): Promise<ReleaseMetadataEntity | null>;
  upsert(metadata: ReleaseMetadataEntity): Promise<void>;
}

export interface ISecurityRepository {
  listByPackageId(packageId: string): Promise<SecurityFindingEntity[]>;
  listAll(): Promise<SecurityFindingEntity[]>;
}
