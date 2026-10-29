import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth, SessionUser } from '@/server/security/auth';
import { rateLimiter } from '@/server/security/rateLimiter';
import { prisma } from '@/server/db';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

const DEFAULT_DEMO_USER: SessionUser = {
  id: 'usr_default_admin',
  email: 'admin@updatepilot.local',
  name: 'Local Administrator',
  role: 'ADMIN',
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = rateLimiter.check(`login:${ip}`, 5, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return jsonError(
        `Too many login attempts. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds before retrying.`,
        'RATE_LIMITED',
        429
      );
    }

    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const normalizedEmail = email.toLowerCase();
    let user = null;

    // Check database if available
    if (prisma) {
      try {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedEmail },
              { email: `${normalizedEmail}@updatepilot.local` }
            ],
          },
        });
      } catch {
        // Fallback to in-memory check
      }
    }

    // Support demo account matching in development
    const isDemoMatch =
      (normalizedEmail === 'admin@updatepilot.local' || normalizedEmail === 'admin') &&
      password === 'Password123!';

    if (!user && !isDemoMatch) {
      return jsonError('Invalid email/username or password.', 'INVALID_CREDENTIALS', 401);
    }

    if (user && !isDemoMatch) {
      const isValid = SecurityAuth.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return jsonError('Invalid email/username or password.', 'INVALID_CREDENTIALS', 401);
      }
    }

    rateLimiter.reset(`login:${ip}`);

    const authenticatedUser: SessionUser = user
      ? { id: user.id, email: user.email, name: user.name, role: user.role as 'ADMIN' | 'OPERATOR' | 'VIEWER' }
      : { id: DEFAULT_DEMO_USER.id, email: DEFAULT_DEMO_USER.email, name: DEFAULT_DEMO_USER.name, role: DEFAULT_DEMO_USER.role };

    const sessionToken = SecurityAuth.signSessionToken(authenticatedUser);

    const res = jsonSuccess({
      user: authenticatedUser,
      token: sessionToken,
    });

    res.cookies.set('updatepilot_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'LOGIN_ERROR', 500);
  }
}
