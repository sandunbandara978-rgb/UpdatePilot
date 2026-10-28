import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);
    if (!userId) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const devices = await deviceService.listDevices(userId);
    return jsonSuccess({ devices });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'DEVICES_ERROR', 500);
  }
}
