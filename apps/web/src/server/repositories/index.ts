import {
  MemoryDeviceRepository,
  MemoryApplicationRepository,
  MemoryJobRepository,
  MemoryAuditRepository,
  MemoryReleaseMetadataRepository,
  MemorySecurityRepository,
  MemoryUserRepository,
  MemorySettingsRepository,
  MemoryApplicationHistoryRepository,
  memoryStore,
} from './memoryStore';
import {
  PrismaDeviceRepository,
  PrismaApplicationRepository,
  PrismaJobRepository,
  PrismaAuditRepository,
  PrismaReleaseMetadataRepository,
  PrismaSecurityRepository,
  PrismaUserRepository,
  PrismaSettingsRepository,
  PrismaApplicationHistoryRepository,
} from './prismaRepositories';
import {
  IDeviceRepository,
  IApplicationRepository,
  IJobRepository,
  IAuditRepository,
  IReleaseMetadataRepository,
  ISecurityRepository,
  IUserRepository,
  ISettingsRepository,
  IApplicationHistoryRepository,
} from './types';

export * from './types';

// Detect whether a live PostgreSQL connection string is configured
const hasDatabase = Boolean(process.env.DATABASE_URL);

if (!hasDatabase && process.env.NODE_ENV === 'production') {
  console.warn(
    'NOTICE: DATABASE_URL is not set in production. UpdatePilot is running with local disk storage (data/updatepilot-storage.json). Configure DATABASE_URL for managed PostgreSQL multi-tenant persistence.'
  );
}

// Singleton repository instances (Prisma with live DB, seamless disk-backed MemoryStore fallback)
export const userRepo: IUserRepository = hasDatabase
  ? new PrismaUserRepository()
  : new MemoryUserRepository();

export const settingsRepo: ISettingsRepository = hasDatabase
  ? new PrismaSettingsRepository()
  : new MemorySettingsRepository();

export const appHistoryRepo: IApplicationHistoryRepository = hasDatabase
  ? new PrismaApplicationHistoryRepository()
  : new MemoryApplicationHistoryRepository();

export const deviceRepo: IDeviceRepository = hasDatabase
  ? new PrismaDeviceRepository()
  : new MemoryDeviceRepository();

export const applicationRepo: IApplicationRepository = hasDatabase
  ? new PrismaApplicationRepository()
  : new MemoryApplicationRepository();

export const jobRepo: IJobRepository = hasDatabase
  ? new PrismaJobRepository()
  : new MemoryJobRepository();

export const auditRepo: IAuditRepository = hasDatabase
  ? new PrismaAuditRepository()
  : new MemoryAuditRepository();

export const releaseMetadataRepo: IReleaseMetadataRepository = hasDatabase
  ? new PrismaReleaseMetadataRepository()
  : new MemoryReleaseMetadataRepository();

export const securityRepo: ISecurityRepository = hasDatabase
  ? new PrismaSecurityRepository()
  : new MemorySecurityRepository();

export { memoryStore };
