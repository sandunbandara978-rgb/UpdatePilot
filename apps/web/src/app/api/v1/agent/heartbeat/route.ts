import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError, jsonAgentError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { AgentHeartbeatSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonError('Missing bearer token', 'UNAUTHORIZED', 401);
    }

    const body = await req.json();
    const validated = AgentHeartbeatSchema.parse(body);

    const result = await deviceService.handleHeartbeat(token, validated);
    return jsonSuccess(result);
  } catch (err: unknown) {
    return jsonAgentError(err, 'HEARTBEAT_ERROR');
  }
}
