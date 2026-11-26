import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError, jsonAgentError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonError('Missing bearer token', 'UNAUTHORIZED', 401);
    }

    const job = await jobService.pollJobForAgent(token);
    return jsonSuccess({ job });
  } catch (err: unknown) {
    return jsonAgentError(err, 'POLL_JOB_ERROR');
  }
}
