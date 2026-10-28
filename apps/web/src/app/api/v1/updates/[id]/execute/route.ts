import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { SecurityAuth } from '@/server/security/auth';
import { UpdateExecuteRequestSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);

    if (!userId) {
      return jsonError('Authentication required to execute software updates.', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    const body = await req.json();
    const validated = UpdateExecuteRequestSchema.parse(body);

    const job = await updateService.executeUpdate({
      applicationId: id,
      acknowledgedTargetVersion: validated.acknowledgedTargetVersion,
      userId,
    });

    return jsonSuccess({ jobId: job.id, status: job.status }, 202);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'UPDATE_EXECUTE_ERROR', 400);
  }
}
