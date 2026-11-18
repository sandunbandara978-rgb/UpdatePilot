import { jsonSuccess } from '@/server/apiResponse';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonSuccess({
    status: 'ok',
    version: '1.0.0',
    storageMode: prisma ? 'postgresql' : process.env.VERCEL ? 'ephemeral-memory' : 'disk',
    platform: process.platform,
    isCloudHosted: Boolean(process.env.VERCEL) || process.platform !== 'win32',
    supportsLocalWinGet: process.platform === 'win32',
    timestamp: new Date().toISOString(),
  });
}

