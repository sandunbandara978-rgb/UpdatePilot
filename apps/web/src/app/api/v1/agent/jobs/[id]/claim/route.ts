import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError, jsonAgentError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonError('Missing bearer token', 'UNAUTHORIZED', 401);
    }

    const { id } = params;
    const result = await jobService.claimJobByAgent(token, id);
    return jsonSuccess(result);
  } catch (err: unknown) {
    return jsonAgentError(err, 'CLAIM_JOB_ERROR');
  }
}
