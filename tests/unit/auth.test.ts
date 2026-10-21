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
});
