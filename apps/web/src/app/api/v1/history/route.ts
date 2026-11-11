import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';
import { auditRepo, deviceRepo } from '@/server/repositories';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const includeAudit = searchParams.get('includeAudit') === 'true';

    const history = await jobService.getUpdateHistory(page, limit, user.id);

    if (includeAudit) {
      const devices = await deviceRepo.listByUserId(user.id);
      const deviceIds = devices.map((d) => d.id);
      const auditEvents = deviceIds.length > 0 ? await auditRepo.list(100, deviceIds) : [];
      return jsonSuccess({ ...history, auditEvents });
    }

    return jsonSuccess(history);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'HISTORY_ERROR', 500);
  }
}
