import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);

    if (!userId) {
      return jsonError('Authentication required to generate pairing codes.', 'UNAUTHORIZED', 401);
    }

    const result = await deviceService.generatePairingCode(userId);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'GENERATE_CODE_ERROR', 500);
  }
}
