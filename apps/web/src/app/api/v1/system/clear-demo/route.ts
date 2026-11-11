import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { memoryStore } from '@/server/repositories';
import { SecurityAuth } from '@/server/security/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required.', 'UNAUTHORIZED', 401);
    }

    const removed = (memoryStore as any)?.clearDemoFixture ? (memoryStore as any).clearDemoFixture() : false;
    return jsonSuccess({ cleared: removed, message: 'Demo fixture data removed.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'CLEAR_DEMO_ERROR', 500);
  }
}
