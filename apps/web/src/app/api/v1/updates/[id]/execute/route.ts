import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { SecurityAuth } from '@/server/security/auth';
import { UpdateExecuteRequestSchema } from '@updatepilot/shared';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required to execute software updates.', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    const body = await req.json();
    const validated = UpdateExecuteRequestSchema.parse(body);

    const job = await updateService.executeUpdate({
      applicationId: id,
      acknowledgedTargetVersion: validated.acknowledgedTargetVersion,
      userId: user.id,
    });

    return jsonSuccess({ jobId: job.id, status: job.status }, 202);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 400;
    return jsonError(msg, 'UPDATE_EXECUTE_ERROR', status);
  }
}
