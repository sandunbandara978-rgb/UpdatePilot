import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { deviceService } from '@/server/services/deviceService';
import { AgentPairRequestSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = AgentPairRequestSchema.parse(body);

    const result = await deviceService.pairDevice(validated);
    return jsonSuccess(result, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'PAIRING_ERROR', 400);
  }
}
