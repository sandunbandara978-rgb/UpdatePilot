import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobRepo, auditRepo, deviceRepo } from '@/server/repositories';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    const userId = user?.id || (process.env.NODE_ENV !== 'production' ? 'usr_default_admin' : null);
    if (!userId) {
      return jsonError('Authentication required to trigger scan.', 'UNAUTHORIZED', 401);
    }

    const deviceId = params.id;
    const device = await deviceRepo.findById(deviceId);
    if (!device) {
      return jsonError('Device not found', 'NOT_FOUND', 404);
    }

    if (device.userId !== userId && userId !== 'usr_default_admin') {
      return jsonError('Forbidden: Access denied to device resources.', 'FORBIDDEN', 403);
    }

    const job = await jobRepo.createScanJob(deviceId);

    await auditRepo.record({
      userId,
      deviceId,
      eventType: 'SCAN_INITIATED',
      action: 'Triggered on-demand inventory scan',
      target: device.deviceName,
      metadata: { scanJobId: job.id },
    });

    return jsonSuccess({ scanJobId: job.id, status: job.status }, 202);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SCAN_CREATE_ERROR', 500);
  }
}
