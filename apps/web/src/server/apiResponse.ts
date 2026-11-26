import { NextResponse } from 'next/server';

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string, code = 'INTERNAL_ERROR', status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * Maps agent endpoint errors to accurate HTTP status codes (401 for revoked/invalid agent tokens, 403 for ownership mismatches).
 */
export function jsonAgentError(err: unknown, defaultCode: string) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('Unauthorized:')) {
    return jsonError(msg, 'UNAUTHORIZED', 401);
  }
  if (msg.startsWith('Forbidden:')) {
    return jsonError(msg, 'FORBIDDEN', 403);
  }
  return jsonError(msg, defaultCode, 400);
}
