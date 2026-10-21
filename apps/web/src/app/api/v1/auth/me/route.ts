import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('updatepilot_session')?.value;
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const token = sessionCookie || authHeader;

  if (!token || !token.startsWith('session_')) {
    return jsonError('Unauthenticated', 'UNAUTHORIZED', 401);
  }

  try {
    const base64Data = token.replace('session_', '');
    const user = JSON.parse(Buffer.from(base64Data, 'base64').toString('utf-8'));
    return jsonSuccess({ user });
  } catch {
    return jsonError('Invalid session token', 'UNAUTHORIZED', 401);
  }
}
