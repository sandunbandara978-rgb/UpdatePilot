import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth } from '@/server/security/auth';
import { settingsRepo } from '@/server/repositories';
import { UserSettingsUpdateSchema } from '@updatepilot/shared';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const settings = await settingsRepo.getByUserId(user.id);
    return jsonSuccess({ settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SETTINGS_LOAD_ERROR', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const body = await req.json();
    const validated = UserSettingsUpdateSchema.parse(body);

    const updated = await settingsRepo.upsert(user.id, validated);
    return jsonSuccess({ settings: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || 'Invalid settings payload', 'VALIDATION_ERROR', 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SETTINGS_SAVE_ERROR', 500);
  }
}

