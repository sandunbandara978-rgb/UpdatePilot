import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const updates = await updateService.getAvailableUpdates(deviceId, user.id);
    return jsonSuccess({ updates, count: updates.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 500;
    return jsonError(msg, 'UPDATES_ERROR', status);
  }
}
