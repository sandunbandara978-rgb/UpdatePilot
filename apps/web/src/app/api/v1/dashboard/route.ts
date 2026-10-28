import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || undefined;

    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : undefined);

    const metrics = await jobService.getDashboardMetrics(deviceId, userId);
    return jsonSuccess(metrics);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'DASHBOARD_ERROR', 500);
  }
}
