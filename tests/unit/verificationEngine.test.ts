import { describe, it, expect } from 'vitest';
import { VerificationEngine } from '../../agent/src/core/verificationEngine';
import { WinGetAdapter, WinGetApp } from '../../agent/src/adapters/wingetAdapter';

class MockWinGetAdapter extends WinGetAdapter {
  private mockApps: WinGetApp[] = [];

  setMockApps(apps: WinGetApp[]) {
    this.mockApps = apps;
  }

  async listInstalledApps(): Promise<WinGetApp[]> {
    return this.mockApps;
  }
}

describe('VerificationEngine Post-Install Verification', () => {
  const mockAdapter = new MockWinGetAdapter();
  const verifier = new VerificationEngine(mockAdapter);

  it('verifies successfully when installed version equals target version', async () => {
    mockAdapter.setMockApps([
      {
        name: 'Notepad++',
        packageId: 'Notepad++.Notepad++',
        version: '8.9.8.1',
      },
    ]);

    const res = await verifier.verifyUpgrade('Notepad++.Notepad++', '8.9.8.1');
    expect(res.verified).toBe(true);
    expect(res.actualInstalledVersion).toBe('8.9.8.1');
    expect(res.details).toContain('Verification successful');
  });

  it('verifies successfully with SemVer clean formatting (e.g. v-prefixes)', async () => {
    mockAdapter.setMockApps([
      {
        name: 'Mozilla Firefox',
        packageId: 'Mozilla.Firefox',
        version: 'v128.0.3',
      },
    ]);

    const res = await verifier.verifyUpgrade('Mozilla.Firefox', '128.0.3');
    expect(res.verified).toBe(true);
    expect(res.actualInstalledVersion).toBe('v128.0.3');
  });

  it('rejects unsafe prefix matches (e.g. target 1.0 vs installed 1.0.1)', async () => {
    mockAdapter.setMockApps([
      {
        name: 'TestApp',
        packageId: 'Test.App',
        version: '1.0.1',
      },
    ]);

    const res = await verifier.verifyUpgrade('Test.App', '1.0');
    expect(res.verified).toBe(false);
    expect(res.details).toContain('Verification failed');
  });

  it('rejects partial prefix matches (e.g. target 10.0.0 vs installed 1.0.0)', async () => {
    mockAdapter.setMockApps([
      {
        name: 'TestApp',
        packageId: 'Test.App',
        version: '1.0.0',
      },
    ]);

    const res = await verifier.verifyUpgrade('Test.App', '10.0.0');
    expect(res.verified).toBe(false);
  });

  it('reports failure when package is missing from post-install inventory', async () => {
    mockAdapter.setMockApps([]);

    const res = await verifier.verifyUpgrade('Missing.Package', '2.0.0');
    expect(res.verified).toBe(false);
    expect(res.details).toContain('could not be located');
  });

  it('reports failure when installed version is still the old version', async () => {
    mockAdapter.setMockApps([
      {
        name: 'Notepad++',
        packageId: 'Notepad++.Notepad++',
        version: '8.8.3',
      },
    ]);

    const res = await verifier.verifyUpgrade('Notepad++.Notepad++', '8.9.8.1');
    expect(res.verified).toBe(false);
    expect(res.actualInstalledVersion).toBe('8.8.3');
    expect(res.details).toContain('does not match approved target version');
  });
});

