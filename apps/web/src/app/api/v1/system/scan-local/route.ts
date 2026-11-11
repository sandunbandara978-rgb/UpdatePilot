import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { localScanService } from '@/server/services/localScanService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required to trigger host scan.', 'UNAUTHORIZED', 401);
    }

    const result = await localScanService.scanLocalHost(user.id);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as any)?.code === 'CLOUD_SERVER_NO_LOCAL_WINGET'
      ? 'CLOUD_SERVER_NO_LOCAL_WINGET'
      : 'LOCAL_SCAN_ERROR';
    const status = code === 'CLOUD_SERVER_NO_LOCAL_WINGET' ? 422 : 500;
    return jsonError(msg, code, status);
  }
}
