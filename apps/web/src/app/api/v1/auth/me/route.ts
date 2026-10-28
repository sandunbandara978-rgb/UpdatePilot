import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth } from '@/server/security/auth';

export async function GET(req: NextRequest) {
  const user = SecurityAuth.getAuthenticatedUser(req);

  if (!user) {
    return jsonError('Unauthenticated', 'UNAUTHORIZED', 401);
  }

  return jsonSuccess({ user });
}

