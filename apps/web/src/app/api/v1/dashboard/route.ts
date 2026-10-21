import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobService } from '@/server/services/jobService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await jobService.getDashboardMetrics();
    return jsonSuccess(metrics);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'DASHBOARD_ERROR', 500);
  }
}
