import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { applicationService } from '@/server/services/applicationService';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const detail = await applicationService.getApplicationDetails(id);
    if (!detail) {
      return jsonError('Application not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(detail);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'APPLICATION_DETAIL_ERROR', 500);
  }
}
