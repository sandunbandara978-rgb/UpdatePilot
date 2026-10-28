import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);

    if (!userId) {
      return jsonError('Authentication required to execute software updates.', 'UNAUTHORIZED', 401);
    }

    let body: { applicationIds?: string[]; deviceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body allowed
    }

    const result = await updateService.executeBatchUpdates({
      applicationIds: body.applicationIds,
      deviceId: body.deviceId,
      userId,
    });

    return jsonSuccess(result, 202);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'BATCH_UPDATE_ERROR', 400);
  }
}
