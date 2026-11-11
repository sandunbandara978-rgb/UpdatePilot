import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || undefined;

    const metrics = await jobService.getDashboardMetrics(deviceId, user.id);
    return jsonSuccess(metrics);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 500;
    return jsonError(msg, 'DASHBOARD_ERROR', status);
  }
}
