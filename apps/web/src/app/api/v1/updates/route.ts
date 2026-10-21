import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const updates = await updateService.getAvailableUpdates(deviceId);
    return jsonSuccess({ updates, count: updates.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'UPDATES_ERROR', 500);
  }
}
