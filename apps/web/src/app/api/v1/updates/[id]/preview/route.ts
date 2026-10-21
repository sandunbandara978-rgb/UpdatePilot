import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const preview = await updateService.previewUpdate(id);
    return jsonSuccess(preview);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'UPDATE_PREVIEW_ERROR', 400);
  }
}
