import { jsonSuccess } from '@/server/apiResponse';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isVercel = Boolean(process.env.VERCEL);
  const hasDb = Boolean(process.env.DATABASE_URL);

  let dbStatus: 'connected' | 'unconfigured' | 'error' = 'unconfigured';
  let dbError: string | null = null;

  if (hasDb && prisma) {
    try {
      // Validate active PostgreSQL connection with a lightweight probe
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (err: unknown) {
      dbStatus = 'error';
      dbError = err instanceof Error ? err.message : String(err);
      console.error('Database connection verification failed:', err);
    }
  }

  return jsonSuccess({
    status: dbStatus === 'error' ? 'degraded' : 'ok',
    version: '1.0.0',
    database: {
      status: dbStatus,
      configured: hasDb,
      error: dbError,
    },
    storageMode: hasDb && dbStatus === 'connected' ? 'postgresql' : isVercel ? 'ephemeral-memory' : 'disk',
    platform: process.platform,
    isCloudHosted: isVercel || process.platform !== 'win32',
    supportsLocalWinGet: process.platform === 'win32',
    timestamp: new Date().toISOString(),
  });
}

