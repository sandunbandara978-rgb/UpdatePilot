import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = await deviceService.listDevices('usr_default_admin');
    return jsonSuccess({ devices });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'DEVICES_ERROR', 500);
  }
}
