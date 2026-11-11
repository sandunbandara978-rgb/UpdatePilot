import { NextRequest } from 'next/server';
import * as os from 'os';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required to generate pairing codes.', 'UNAUTHORIZED', 401);
    }

    const result = await deviceService.generatePairingCode(user.id);

    const nets = os.networkInterfaces();
    const lanIps: string[] = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          lanIps.push(net.address);
        }
      }
    }
    const suggestedServerUrl = lanIps.length > 0 ? `http://${lanIps[0]}:3000` : undefined;

    return jsonSuccess({
      ...result,
      lanIps,
      suggestedServerUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'GENERATE_CODE_ERROR', 500);
  }
}
