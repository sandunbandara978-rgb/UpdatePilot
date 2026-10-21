import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobRepo, auditRepo, deviceRepo } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deviceId = params.id;
    const device = await deviceRepo.findById(deviceId);
    if (!device) {
      return jsonError('Device not found', 'NOT_FOUND', 404);
    }

    const job = await jobRepo.createScanJob(deviceId);

    await auditRepo.record({
      userId: 'usr_default_admin',
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
