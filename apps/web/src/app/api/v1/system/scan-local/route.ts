import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { localScanService } from '@/server/services/localScanService';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const result = await localScanService.scanLocalHost('usr_default_admin');
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'LOCAL_SCAN_ERROR', 500);
  }
}
