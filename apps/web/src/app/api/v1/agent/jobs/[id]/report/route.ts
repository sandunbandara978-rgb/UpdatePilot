import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';
import { AgentJobReportSchema } from '@updatepilot/shared';

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
    const body = await req.json();
    const validated = AgentJobReportSchema.parse(body);

    const result = await jobService.reportJobByAgent(token, id, validated);
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'REPORT_JOB_ERROR', 400);
  }
}
