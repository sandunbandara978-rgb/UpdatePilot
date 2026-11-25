import { NextRequest } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth, SessionUser } from '@/server/security/auth';
import { rateLimiter } from '@/server/security/rateLimiter';
import { userRepo } from '@/server/repositories';
import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = rateLimiter.check(`login:${ip}`, 20, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return jsonError(
        `Too many login attempts. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds before retrying.`,
        'RATE_LIMITED',
        429
      );
    }

    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const normalized = email.toLowerCase();

    // 1. If Supabase is active, authenticate via Supabase Auth
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: normalized.includes('@') ? normalized : `${normalized}@updatepilot.local`,
          password,
        });

        if (authData?.user && !authErr) {
          const profile = await userRepo.findById(authData.user.id);
          const sessionUser: SessionUser = {
            id: authData.user.id,
            email: authData.user.email || normalized,
            name: profile?.name || authData.user.user_metadata?.name || normalized,
            role: (profile?.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR') as SessionUser['role'],
          };

          const sessionToken = SecurityAuth.signSessionToken(sessionUser);
          const isHttps =
            req.nextUrl.protocol === 'https:' ||
            req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';

          const res = jsonSuccess({
            user: sessionUser,
            token: sessionToken,
            supabaseAccessToken: authData.session?.access_token,
          });

          res.cookies.set('updatepilot_session', sessionToken, {
            path: '/',
            httpOnly: true,
            secure: isHttps,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
          });

          if (authData.session?.access_token) {
            res.cookies.set('sb-access-token', authData.session.access_token, {
              path: '/',
              httpOnly: true,
              secure: isHttps,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
            });
          }

          rateLimiter.reset(`login:${ip}`);
          return res;
        }
      } catch (err) {
        console.warn('Supabase auth sign-in error, trying database fallback:', err);
      }
    }

    // 2. Direct user repository fallback (for bootstrap admin or Prisma/Disk mode)
    let user = await userRepo.findByEmail(normalized);
    if (!user && !normalized.includes('@')) {
      user = await userRepo.findByEmail(`${normalized}@updatepilot.local`);
    }

    // Bootstrap default administrator automatically on an empty database if signing in with default admin credentials
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password123!';
    if (
      !user &&
      (normalized === 'admin@updatepilot.local' || normalized === 'admin') &&
      password === defaultPassword &&
      (await userRepo.count()) === 0
    ) {
      user = await userRepo.create({
        id: 'usr_default_admin',
        email: 'admin@updatepilot.local',
        name: 'Local Administrator',
        passwordHash: SecurityAuth.hashPassword(defaultPassword),
        role: 'ADMIN',
      });
    }

    if (!user) {
      return jsonError('Invalid email/username or password.', 'INVALID_CREDENTIALS', 401);
    }

    const isValid = user.passwordHash
      ? SecurityAuth.verifyPassword(password, user.passwordHash)
      : password === defaultPassword;

    if (!isValid) {
      return jsonError('Invalid email/username or password.', 'INVALID_CREDENTIALS', 401);
    }

    rateLimiter.reset(`login:${ip}`);

    const authenticatedUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user.role === 'ADMIN' || user.role === 'OPERATOR' || user.role === 'VIEWER'
        ? user.role
        : 'OPERATOR') as SessionUser['role'],
    };

    const sessionToken = SecurityAuth.signSessionToken(authenticatedUser);
    const isHttps =
      req.nextUrl.protocol === 'https:' ||
      req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';

    const res = jsonSuccess({
      user: authenticatedUser,
      token: sessionToken,
    });

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
    return jsonError(msg, 'LOGIN_ERROR', 500);
  }
}
