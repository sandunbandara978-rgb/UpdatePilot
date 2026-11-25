import { isSupabaseConfigured } from '@/lib/supabase/admin';
import {
  SupabaseUserRepository,
  SupabaseSettingsRepository,
  SupabaseApplicationHistoryRepository,
  SupabaseDeviceRepository,
  SupabaseApplicationRepository,
  SupabaseJobRepository,
  SupabaseAuditRepository,
  SupabaseReleaseMetadataRepository,
  SupabaseSecurityRepository,
} from './supabaseRepositories';
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

// Detect persistence mode:
// 1. Supabase (Primary when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set)
// 2. Direct PostgreSQL / Prisma (when DATABASE_URL is set)
// 3. Local disk storage (fallback for standalone local development)
const useSupabase = isSupabaseConfigured();
const usePrisma = !useSupabase && Boolean(process.env.DATABASE_URL);

if (!useSupabase && !usePrisma && process.env.NODE_ENV === 'production') {
  console.warn(
    'NOTICE: Supabase or DATABASE_URL is not set in production. UpdatePilot is running with local disk storage (data/updatepilot-storage.json). Configure NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY for managed Supabase persistence.'
  );
}

// Singleton repository instances
export const userRepo: IUserRepository = useSupabase
  ? new SupabaseUserRepository()
  : usePrisma
    ? new PrismaUserRepository()
    : new MemoryUserRepository();

export const settingsRepo: ISettingsRepository = useSupabase
  ? new SupabaseSettingsRepository()
  : usePrisma
    ? new PrismaSettingsRepository()
    : new MemorySettingsRepository();

export const appHistoryRepo: IApplicationHistoryRepository = useSupabase
  ? new SupabaseApplicationHistoryRepository()
  : usePrisma
    ? new PrismaApplicationHistoryRepository()
    : new MemoryApplicationHistoryRepository();

export const deviceRepo: IDeviceRepository = useSupabase
  ? new SupabaseDeviceRepository()
  : usePrisma
    ? new PrismaDeviceRepository()
    : new MemoryDeviceRepository();

export const applicationRepo: IApplicationRepository = useSupabase
  ? new SupabaseApplicationRepository()
  : usePrisma
    ? new PrismaApplicationRepository()
    : new MemoryApplicationRepository();

export const jobRepo: IJobRepository = useSupabase
  ? new SupabaseJobRepository()
  : usePrisma
    ? new PrismaJobRepository()
    : new MemoryJobRepository();

export const auditRepo: IAuditRepository = useSupabase
  ? new SupabaseAuditRepository()
  : usePrisma
    ? new PrismaAuditRepository()
    : new MemoryAuditRepository();

export const releaseMetadataRepo: IReleaseMetadataRepository = useSupabase
  ? new SupabaseReleaseMetadataRepository()
  : usePrisma
    ? new PrismaReleaseMetadataRepository()
    : new MemoryReleaseMetadataRepository();

export const securityRepo: ISecurityRepository = useSupabase
  ? new SupabaseSecurityRepository()
  : usePrisma
    ? new PrismaSecurityRepository()
    : new MemorySecurityRepository();

export { memoryStore };
