import {
  MemoryDeviceRepository,
  MemoryApplicationRepository,
  MemoryJobRepository,
  MemoryAuditRepository,
  MemoryReleaseMetadataRepository,
  MemorySecurityRepository,
  memoryStore,
} from './memoryStore';
import {
  PrismaDeviceRepository,
  PrismaApplicationRepository,
  PrismaJobRepository,
  PrismaAuditRepository,
  PrismaReleaseMetadataRepository,
  PrismaSecurityRepository,
} from './prismaRepositories';
import {
  IDeviceRepository,
  IApplicationRepository,
  IJobRepository,
  IAuditRepository,
  IReleaseMetadataRepository,
  ISecurityRepository,
} from './types';

export * from './types';

// Detect whether a live PostgreSQL connection string is configured
const hasDatabase = Boolean(process.env.DATABASE_URL);

if (!hasDatabase && process.env.NODE_ENV === 'production') {
  console.error(
    'CRITICAL WARNING: DATABASE_URL is not set in production! UpdatePilot will run with disk-backed storage. Configure a persistent PostgreSQL database for production multi-tenant reliability.'
  );
}

// Singleton repository instances (Prisma with live DB, seamless Memory fallback for local/test dev)
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
