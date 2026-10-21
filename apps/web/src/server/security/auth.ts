import * as crypto from 'crypto';

export interface TokenHashResult {
  token: string;
  hash: string;
  salt: string;
}

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
}
