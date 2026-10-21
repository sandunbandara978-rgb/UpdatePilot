export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'REVOKED';

export type ApplicationStatus =
  | 'UP_TO_DATE'
  | 'UPDATE_AVAILABLE'
  | 'UNKNOWN_VERSION'
  | 'UNSUPPORTED'
  | 'UNMATCHED';

export type JobStatus =
  | 'QUEUED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RESTART_REQUIRED'
  | 'CANCELLED'
  | 'INTERRUPTED';

export type JobType = 'SCAN' | 'UPDATE';

export type AuditEventType =
  | 'AGENT_PAIRED'
  | 'AGENT_REVOKED'
  | 'SCAN_INITIATED'
  | 'SCAN_COMPLETED'
  | 'UPDATE_CONFIRMED'
  | 'UPDATE_COMPLETED'
  | 'UPDATE_FAILED';

export interface DeviceEntity {
  id: string;
  userId: string;
  deviceName: string;
  osVersion: string;
  osBuild?: string;
  agentVersion: string;
  status: DeviceStatus;
  lastSeenAt: string;
  createdAt: string;
}

export interface ApplicationEntity {
  id: string;
  deviceId: string;
  name: string;
  packageId?: string | null;
  publisher?: string | null;
  installedVersion: string;
  availableVersion?: string | null;
  source?: string | null;
  status: ApplicationStatus;
  lastScannedAt: string;
}

export interface ReleaseMetadataEntity {
  packageId: string;
  latestVersion: string;
  publisherUrl?: string | null;
  releaseNotesUrl?: string | null;
  license?: string | null;
  installerType?: string | null;
  sha256?: string | null;
  releaseDate?: string | null;
}

export interface ScanJobEntity {
  id: string;
  deviceId: string;
  status: JobStatus;
  appsDiscovered: number;
  updatesDetected: number;
  errorDetails?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface UpdateJobEntity {
  id: string;
  deviceId: string;
  applicationId: string;
  packageId: string;
  currentVersion: string;
  targetVersion: string;
  status: JobStatus;
  exitCode?: number | null;
  executionOutput?: string | null;
  verificationDetails?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface AuditEventEntity {
  id: string;
  userId?: string | null;
  deviceId?: string | null;
  eventType: AuditEventType;
  action: string;
  target: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface SecurityFindingEntity {
  id: string;
  packageId: string;
  cveId: string;
  summary: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedVersions: string;
  fixedVersion?: string | null;
  advisoryUrl?: string | null;
  publishedAt: string;
}

export interface DashboardMetrics {
  totalApplications: number;
  updatesAvailable: number;
  upToDate: number;
  unsupported: number;
  unknown: number;
  activeDevicesCount: number;
  lastScanTimestamp: string | null;
  recentActivity: Array<{
    id: string;
    type: 'SCAN' | 'UPDATE';
    title: string;
    status: JobStatus;
    timestamp: string;
    details?: string;
  }>;
}
