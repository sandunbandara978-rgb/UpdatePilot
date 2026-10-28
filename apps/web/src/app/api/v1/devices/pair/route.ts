import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { rateLimiter } from '@/server/security/rateLimiter';
import { AgentPairRequestSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = rateLimiter.check(`pair:${ip}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return jsonError('Too many pairing attempts. Please wait before retrying.', 'RATE_LIMITED', 429);
    }

    const body = await req.json();
    const validated = AgentPairRequestSchema.parse(body);

    const result = await deviceService.pairDevice(validated);
    return jsonSuccess(result, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'PAIRING_ERROR', 400);
  }
}
