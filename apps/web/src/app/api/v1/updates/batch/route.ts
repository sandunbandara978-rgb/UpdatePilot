import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: { applicationIds?: string[]; deviceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body allowed
    }

    const result = await updateService.executeBatchUpdates({
      applicationIds: body.applicationIds,
      deviceId: body.deviceId,
      userId: 'usr_default_admin',
    });

    return jsonSuccess(result, 202);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'BATCH_UPDATE_ERROR', 400);
  }
}
