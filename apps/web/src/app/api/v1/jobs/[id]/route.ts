import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const jobStatus = await jobService.getJobStatus(id);
    if (!jobStatus) {
      return jsonError('Job not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(jobStatus);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'JOB_STATUS_ERROR', 500);
  }
}
