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
    if (!user) {
      return jsonError('Authentication required to revoke device.', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    await deviceService.revokeDevice(id, user.id);
    return jsonSuccess({ revoked: true, deviceId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : msg === 'Device not found' ? 404 : 400;
    return jsonError(msg, 'REVOCATION_ERROR', status);
  }
}
