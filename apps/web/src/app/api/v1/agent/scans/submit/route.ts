import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { applicationService } from '@/server/services/applicationService';
import { ScanSubmitPayloadSchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonError('Missing bearer token', 'UNAUTHORIZED', 401);
    }

    const body = await req.json();
    const validated = ScanSubmitPayloadSchema.parse(body);

    const result = await applicationService.submitScanResults(
      token,
      validated.scanJobId,
      validated.applications
    );

    return jsonSuccess({ acknowledged: true, appsSaved: result.appsSaved, updatesCount: result.updatesCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SCAN_SUBMIT_ERROR', 400);
  }
}
