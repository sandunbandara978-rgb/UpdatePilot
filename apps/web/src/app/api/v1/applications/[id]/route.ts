import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { applicationService } from '@/server/services/applicationService';
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
    const detail = await applicationService.getApplicationDetails(id, user.id);
    if (!detail) {
      return jsonError('Application not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(detail);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 500;
    return jsonError(msg, 'APPLICATION_DETAIL_ERROR', status);
  }
}
