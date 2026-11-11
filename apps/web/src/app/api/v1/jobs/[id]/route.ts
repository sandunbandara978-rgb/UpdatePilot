import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    const jobStatus = await jobService.getJobStatus(id, user.id);
    if (!jobStatus) {
      return jsonError('Job not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(jobStatus);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 500;
    return jsonError(msg, 'JOB_STATUS_ERROR', status);
  }
}
