import { describe, it, expect } from 'vitest';
import { SecurityAuth } from '../../apps/web/src/server/security/auth';

describe('SecurityAuth Cryptographic Engine', () => {
  it('generates valid 6-digit formatted pairing codes', () => {
    const code = SecurityAuth.generatePairingCode();
    expect(code).toMatch(/^UP-\d{6}$/);

    const code2 = SecurityAuth.generatePairingCode();
    expect(code2).toMatch(/^UP-\d{6}$/);
    expect(code).not.toBe(code2);
  });

  it('generates unique high-entropy agent bearer tokens and verifies hashes', () => {
    const { token, hash, salt } = SecurityAuth.generateAgentToken();

    expect(token).toMatch(/^agt_[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
    expect(salt).toHaveLength(32);

    const isValid = SecurityAuth.verifyAgentToken(token, hash, salt);
    expect(isValid).toBe(true);

    const isTampered = SecurityAuth.verifyAgentToken(token + 'x', hash, salt);
    expect(isTampered).toBe(false);

    const isWrongSalt = SecurityAuth.verifyAgentToken(token, hash, '0'.repeat(32));
    expect(isWrongSalt).toBe(false);
  });

  it('correctly hashes and verifies user passwords with PBKDF2-SHA512', () => {
    const password = 'CorrectHorseBatteryStaple123!';
    const passwordHash = SecurityAuth.hashPassword(password);

    expect(passwordHash).toContain(':');
    const [salt, key] = passwordHash.split(':');
    expect(salt).toHaveLength(32);
    expect(key).toHaveLength(128);

    expect(SecurityAuth.verifyPassword(password, passwordHash)).toBe(true);
    expect(SecurityAuth.verifyPassword('WrongPassword123!', passwordHash)).toBe(false);
    expect(SecurityAuth.verifyPassword('', passwordHash)).toBe(false);
  });

  it('handles corrupted password hashes gracefully', () => {
    expect(SecurityAuth.verifyPassword('test', 'invalidhashwithoutcolon')).toBe(false);
  });

  it('signs and verifies user session tokens with expiry validation', () => {
    const user = {
      id: 'usr_test_123',
      email: 'test@updatepilot.local',
      name: 'Test Engineer',
      role: 'ADMIN' as const,
    };

    const token = SecurityAuth.signSessionToken(user, 3600 * 1000);
    const parsed = SecurityAuth.verifySessionToken(token);

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe(user.id);
    expect(parsed?.email).toBe(user.email);
    expect(parsed?.role).toBe('ADMIN');
    expect(parsed?.exp).toBeGreaterThan(Date.now());

    // Reject tampered session token
    const tampered = token.slice(0, -4) + 'abcd';
    expect(SecurityAuth.verifySessionToken(tampered)).toBeNull();

    // Reject malformed token
    expect(SecurityAuth.verifySessionToken('invalid.token')).toBeNull();
  });

  it('rejects expired session tokens', () => {
    const user = {
      id: 'usr_expired',
      email: 'expired@updatepilot.local',
      name: 'Expired User',
      role: 'VIEWER' as const,
    };

    // Generate token that expired 10 seconds ago
    const expiredToken = SecurityAuth.signSessionToken(user, -10000);
    const parsed = SecurityAuth.verifySessionToken(expiredToken);
    expect(parsed).toBeNull();
  });

  it('strictly enforces SESSION_SECRET in production mode', () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;

      expect(() => {
        SecurityAuth.signSessionToken({
          id: 'usr_prod',
          email: 'admin@prod.corp',
          name: 'Prod Admin',
          role: 'ADMIN',
        });
      }).toThrow(/SESSION_SECRET.*must be configured in production/i);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origSecret) {
        process.env.SESSION_SECRET = origSecret;
      }
    }
  });
});
