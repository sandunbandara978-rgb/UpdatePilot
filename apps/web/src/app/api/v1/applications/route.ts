import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { applicationService } from '@/server/services/applicationService';
import { SecurityAuth } from '@/server/security/auth';
import { InventoryQuerySchema } from '@updatepilot/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = InventoryQuerySchema.parse({
      deviceId: searchParams.get('deviceId') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    });

    const result = await applicationService.listApplications({
      ...parsedQuery,
      userId: user.id,
    });
    return jsonSuccess(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('Forbidden') ? 403 : 400;
    return jsonError(msg, 'INVENTORY_QUERY_ERROR', status);
  }
}
