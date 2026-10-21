import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await deviceService.generatePairingCode('usr_default_admin');
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'GENERATE_CODE_ERROR', 500);
  }
}
