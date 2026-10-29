import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { updateService } from '@/server/services/updateService';
import { SecurityAuth } from '@/server/security/auth';
import { BatchUpdateExecuteSchema } from '@updatepilot/shared';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required to execute software updates.', 'UNAUTHORIZED', 401);
    }

    const body = await req.json();
    const validated = BatchUpdateExecuteSchema.parse(body);

    const result = await updateService.executeBatchUpdates({
      applicationIds: validated.applicationIds,
      items: validated.items,
      deviceId: validated.deviceId,
      userId: user.id,
    });

    return jsonSuccess(result, 202);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'BATCH_UPDATE_ERROR', 400);
  }
}
