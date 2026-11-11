import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { jobRepo } from '@/server/repositories';
import { deviceService } from '@/server/services/deviceService';
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

    const scanJob = await jobRepo.findScanJobById(params.id);
    if (!scanJob) {
      return jsonError('Scan job not found', 'NOT_FOUND', 404);
    }

    await deviceService.assertDeviceOwnership(scanJob.deviceId, user.id);
    return jsonSuccess({ scan: scanJob });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 500;
    return jsonError(msg, 'SCAN_STATUS_ERROR', status);
  }
}

