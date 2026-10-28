import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { localScanService } from '@/server/services/localScanService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);

    if (!userId) {
      return jsonError('Authentication required to trigger host scan.', 'UNAUTHORIZED', 401);
    }

    const result = await localScanService.scanLocalHost(userId);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'LOCAL_SCAN_ERROR', 500);
  }
}
