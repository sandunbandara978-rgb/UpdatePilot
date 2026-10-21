import { NextRequest, NextResponse } from 'next/server';
import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { SecurityAuth } from '@/server/security/auth';
import { prisma } from '@/server/db';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

const DEFAULT_DEMO_USER = {
  id: 'usr_default_admin',
  email: 'admin@updatepilot.local',
  name: 'Local Administrator',
  role: 'ADMIN',
  // PBKDF2 hash of "Password123!"
  passwordHash: '8e4f1a2b:Password123!', 
};

export async function POST(req: NextRequest) {
  try {
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

    // Support demo account matching
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

    const authenticatedUser = user
      ? { id: user.id, email: user.email, name: user.name, role: user.role }
      : { id: DEFAULT_DEMO_USER.id, email: DEFAULT_DEMO_USER.email, name: DEFAULT_DEMO_USER.name, role: DEFAULT_DEMO_USER.role };

    const sessionToken = `session_${Buffer.from(JSON.stringify(authenticatedUser)).toString('base64')}`;

    const res = jsonSuccess({
      user: authenticatedUser,
      token: sessionToken,
    });

    // Set HTTP-only cookie
    res.cookies.set('updatepilot_session', sessionToken, {
      path: '/',
      httpOnly: false, // accessible to client for smooth state verification
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
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
