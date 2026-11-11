import { jsonSuccess } from '@/server/apiResponse';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonSuccess({
    status: 'ok',
    version: '1.0.0',
    storageMode: prisma ? 'postgresql' : 'disk',
    platform: process.platform,
    supportsLocalWinGet: process.platform === 'win32',
    timestamp: new Date().toISOString(),
  });
}

