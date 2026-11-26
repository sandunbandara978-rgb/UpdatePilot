import { jsonSuccess } from '@/server/apiResponse';
import { prisma } from '@/server/db';
import { isSupabaseConfigured, getSupabaseAdmin, getSupabaseEnv } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isVercel = Boolean(process.env.VERCEL);
  const supabaseEnv = getSupabaseEnv();
  const hasSupabase = isSupabaseConfigured();
  const hasDb = Boolean(process.env.DATABASE_URL);

  let dbStatus: 'connected' | 'unconfigured' | 'error' = 'unconfigured';
  let dbProvider: 'supabase' | 'postgresql' | 'disk' | 'ephemeral-memory' = 'disk';
  let dbError: string | null = null;

  if (hasSupabase) {
    dbProvider = 'supabase';
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) {
        dbStatus = 'error';
        dbError = error.message;
      } else {
        dbStatus = 'connected';
      }
    } catch (err: unknown) {
      dbStatus = 'error';
      dbError = err instanceof Error ? err.message : String(err);
    }
  } else if (hasDb && prisma) {
    dbProvider = 'postgresql';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (err: unknown) {
      dbStatus = 'error';
      dbError = err instanceof Error ? err.message : String(err);
      console.error('Database connection verification failed:', err);
    }
  } else if (isVercel) {
    dbProvider = 'ephemeral-memory';
  }

  return jsonSuccess({
    status: dbStatus === 'error' ? 'degraded' : 'ok',
    version: '1.0.0',
    database: {
      status: dbStatus,
      provider: dbProvider,
      configured: hasSupabase || hasDb,
      error: dbError,
      envDetected: {
        hasUrl: Boolean(supabaseEnv.url),
        hasAnonKey: Boolean(supabaseEnv.anonKey),
        hasServiceRoleKey: Boolean(supabaseEnv.serviceRoleKey),
        hasDatabaseUrl: hasDb,
      },
    },
    storageMode: dbProvider,
    platform: process.platform,
    isCloudHosted: isVercel || process.platform !== 'win32',
    supportsLocalWinGet: process.platform === 'win32',
    timestamp: new Date().toISOString(),
  });
}

