import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth, SessionUser } from '@/server/security/auth';
import { rateLimiter } from '@/server/security/rateLimiter';
import { userRepo } from '@/server/repositories';
import { UserRegisterSchema } from '@updatepilot/shared';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = rateLimiter.check(`register:${ip}`, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return jsonError(
        `Too many registration attempts. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds before retrying.`,
        'RATE_LIMITED',
        429
      );
    }

    const body = await req.json();
    const { email, name, password } = UserRegisterSchema.parse(body);

    const existing = await userRepo.findByEmail(email);
    if (existing) {
      return jsonError('An account with this email already exists.', 'EMAIL_EXISTS', 409);
    }

    const existingCount = await userRepo.count();
    const role = existingCount === 0 ? 'ADMIN' : 'USER';
    const passwordHash = SecurityAuth.hashPassword(password);

    const created = await userRepo.create({
      email,
      name,
      passwordHash,
      role,
    });

    const sessionUser: SessionUser = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
    };

    const sessionToken = SecurityAuth.signSessionToken(sessionUser);
    const isHttps =
      req.nextUrl.protocol === 'https:' ||
      req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
    const res = jsonSuccess({ user: sessionUser, token: sessionToken }, 201);

    res.cookies.set('updatepilot_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'REGISTER_ERROR', 500);
  }
}

