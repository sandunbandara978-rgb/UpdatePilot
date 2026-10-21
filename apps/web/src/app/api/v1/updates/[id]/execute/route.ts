import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { UpdateExecuteRequestSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const validated = UpdateExecuteRequestSchema.parse(body);

    const job = await updateService.executeUpdate({
      applicationId: id,
      acknowledgedTargetVersion: validated.acknowledgedTargetVersion,
      userId: 'usr_default_admin',
    });

    return jsonSuccess({ jobId: job.id, status: job.status }, 202);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'UPDATE_EXECUTE_ERROR', 400);
  }
}
