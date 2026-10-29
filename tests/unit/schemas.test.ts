import { describe, it, expect } from 'vitest';
import {
  SAFE_PACKAGE_ID_REGEX,
  AgentPairRequestSchema,
  DiscoveredAppSchema,
  UpdateExecuteRequestSchema,
  BatchUpdateExecuteSchema,
  InventoryQuerySchema,
} from '../../packages/shared/src/schemas';

describe('Shared Zod Schemas Validation', () => {
  it('validates safe package IDs', () => {
    expect(SAFE_PACKAGE_ID_REGEX.test('Notepad++.Notepad++')).toBe(true);
    expect(SAFE_PACKAGE_ID_REGEX.test('Google.Chrome')).toBe(true);
    expect(SAFE_PACKAGE_ID_REGEX.test('Microsoft.VisualStudioCode')).toBe(true);
    expect(SAFE_PACKAGE_ID_REGEX.test('7zip.7zip')).toBe(true);
    expect(SAFE_PACKAGE_ID_REGEX.test('MSIX\\Microsoft.AVCEncoderVideoExtension_1.1.47.0_x64__8wekyb3d8bbwe')).toBe(true);
    expect(SAFE_PACKAGE_ID_REGEX.test('{F4786A00-84C0-466D-A08D-7323A50B01D5}')).toBe(true);

    // Injection attempts must fail
    expect(SAFE_PACKAGE_ID_REGEX.test('pkg & calc.exe')).toBe(false);
    expect(SAFE_PACKAGE_ID_REGEX.test('pkg; rm -rf')).toBe(false);
    expect(SAFE_PACKAGE_ID_REGEX.test('pkg|whoami')).toBe(false);
    expect(SAFE_PACKAGE_ID_REGEX.test('pkg`id`')).toBe(false);
  });

  it('validates agent pairing request schema', () => {
    const valid = {
      pairingCode: 'UP-892401',
      deviceName: 'DESKTOP-WIN11',
      osVersion: 'Windows 11 Pro 23H2',
      agentVersion: '1.0.0',
    };
    expect(AgentPairRequestSchema.parse(valid)).toEqual(valid);

    // Short pairing code must fail
    expect(() =>
      AgentPairRequestSchema.parse({
        ...valid,
        pairingCode: '12',
      })
    ).toThrow();
  });

  it('validates update execute confirmation schema', () => {
    expect(
      UpdateExecuteRequestSchema.parse({
        confirmed: true,
        acknowledgedTargetVersion: '8.9.8.1',
      })
    ).toEqual({
      confirmed: true,
      acknowledgedTargetVersion: '8.9.8.1',
    });

    // Unconfirmed request must fail
    expect(() =>
      UpdateExecuteRequestSchema.parse({
        confirmed: false,
        acknowledgedTargetVersion: '8.9.8.1',
      })
    ).toThrow();
  });

  it('applies default pagination and sorting in inventory query schema', () => {
    const parsed = InventoryQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortBy).toBe('name');
    expect(parsed.sortOrder).toBe('asc');
  });

  it('validates batch update confirmation schema', () => {
    const valid = {
      confirmed: true as const,
      items: [
        { applicationId: 'app_1', targetVersion: '2.0.0' },
        { applicationId: 'app_2', targetVersion: '3.1.4' },
      ],
      deviceId: 'dev_123',
    };
    expect(BatchUpdateExecuteSchema.parse(valid)).toEqual(valid);

    // Reject unconfirmed batch
    expect(() =>
      BatchUpdateExecuteSchema.parse({
        ...valid,
        confirmed: false,
      })
    ).toThrow();

    // Reject empty items & empty applicationIds
    expect(() =>
      BatchUpdateExecuteSchema.parse({
        confirmed: true,
        items: [],
      })
    ).toThrow();
  });
});
