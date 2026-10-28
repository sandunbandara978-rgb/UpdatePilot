import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);
    if (!userId) {
      return jsonError('Authentication required to revoke device.', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    await deviceService.revokeDevice(id, userId);
    return jsonSuccess({ revoked: true, deviceId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'REVOCATION_ERROR', 400);
  }
}
