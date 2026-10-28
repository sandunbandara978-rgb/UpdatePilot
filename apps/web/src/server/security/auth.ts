import * as crypto from 'crypto';
import { NextRequest } from 'next/server';

export interface TokenHashResult {
  token: string;
  hash: string;
  salt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'updatepilot_secure_default_session_secret_key_2026';

export class SecurityAuth {
  /**
   * Generates a 6-digit one-time alphanumeric pairing code.
   * Format: UP-XXXXXX (e.g., UP-892401)
   */
  static generatePairingCode(): string {
    const randomNum = crypto.randomInt(100000, 999999);
    return `UP-${randomNum}`;
  }

  /**
   * Generates a cryptographically strong agent token and returns its salted SHA-256 hash.
   */
  static generateAgentToken(): TokenHashResult {
    const token = `agt_${crypto.randomBytes(32).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashToken(token, salt);
    return { token, hash, salt };
  }

  /**
   * Hashes a token using SHA-256 and salt.
   */
  static hashToken(token: string, salt: string): string {
    return crypto.createHmac('sha256', salt).update(token).digest('hex');
  }

  /**
   * Verifies an incoming agent Bearer token against stored hash and salt.
   */
  static verifyAgentToken(token: string, storedHash: string, salt: string): boolean {
    const computedHash = this.hashToken(token, salt);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  }

  /**
   * Hashes a user password using PBKDF2 with SHA-512.
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies a user password against the stored PBKDF2 hash.
   */
  static verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(key));
  }

  /**
   * Cryptographically signs a session token for an authenticated user.
   * Format: session_<base64Payload>.<hmacSignature>
   */
  static signSessionToken(user: SessionUser): string {
    const payloadStr = JSON.stringify(user);
    const payloadBase64 = Buffer.from(payloadStr).toString('base64');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('hex');
    return `session_${payloadBase64}.${signature}`;
  }

  /**
   * Verifies a session token's cryptographic signature and returns the deserialized SessionUser.
   */
  static verifySessionToken(token: string): SessionUser | null {
    if (!token || !token.startsWith('session_')) return null;

    const tokenBody = token.replace('session_', '');
    const parts = tokenBody.split('.');

    // Signed token format: <payload>.<sig>
    if (parts.length === 2) {
      const [payloadBase64, providedSig] = parts;
      const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('hex');

      if (
        providedSig.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
      ) {
        return null;
      }

      try {
        const jsonStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const user = JSON.parse(jsonStr) as SessionUser;
        if (user && user.id && user.email) {
          return user;
        }
      } catch {
        return null;
      }
    }

    // Unsigned token fallback (development & test compatibility)
    if (parts.length === 1 && process.env.NODE_ENV !== 'production') {
      try {
        const jsonStr = Buffer.from(parts[0], 'base64').toString('utf-8');
        const user = JSON.parse(jsonStr) as SessionUser;
        if (user && user.id && user.email) {
          return user;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Extracts and authenticates the user from the incoming NextRequest.
   * Checks Bearer Authorization header first, then updatepilot_session cookie.
   */
  static getAuthenticatedUser(req: NextRequest): SessionUser | null {
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const cookieToken = req.cookies.get('updatepilot_session')?.value?.trim();

    const token = authHeader || cookieToken;
    if (!token) return null;

    return this.verifySessionToken(token);
  }
}
