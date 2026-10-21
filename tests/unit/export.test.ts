import { describe, it, expect } from 'vitest';

function escapeCsvField(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function generateApplicationCsv(apps: Array<{
  name: string;
  packageId?: string | null;
  publisher?: string | null;
  installedVersion: string;
  availableVersion?: string | null;
  source?: string | null;
  status: string;
  lastScannedAt: string;
}>): string {
  const header = 'Name,Package ID,Publisher,Installed Version,Available Version,Source,Status,Last Scanned\r\n';
  const rows = apps.map((a) =>
    `${escapeCsvField(a.name)},${escapeCsvField(a.packageId)},${escapeCsvField(a.publisher)},${escapeCsvField(a.installedVersion)},${escapeCsvField(a.availableVersion)},${escapeCsvField(a.source)},${escapeCsvField(a.status)},${escapeCsvField(a.lastScannedAt)}`
  ).join('\r\n');
  return header + rows;
}

describe('CSV Compliance Report Generation', () => {
  it('correctly handles RFC-4180 CSV escaping for quotes and commas', () => {
    const apps = [
      {
        name: 'Visual Studio Code, Community Edition',
        packageId: 'Microsoft.VisualStudioCode',
        publisher: 'Microsoft "Dev" Team',
        installedVersion: '1.93.0',
        availableVersion: '1.94.0',
        source: 'winget',
        status: 'UPDATE_AVAILABLE',
        lastScannedAt: '2026-10-21T10:00:00.000Z',
      },
    ];

    const csv = generateApplicationCsv(apps);
    expect(csv).toContain('Name,Package ID,Publisher,Installed Version,Available Version,Source,Status,Last Scanned');
    expect(csv).toContain('"Visual Studio Code, Community Edition"');
    expect(csv).toContain('"Microsoft ""Dev"" Team"');
  });

  it('handles null and optional fields without breaking CSV row structure', () => {
    const apps = [
      {
        name: 'Proprietary Software',
        packageId: null,
        publisher: null,
        installedVersion: '1.0.0',
        availableVersion: null,
        source: null,
        status: 'UNSUPPORTED',
        lastScannedAt: '2026-10-21T10:00:00.000Z',
      },
    ];

    const csv = generateApplicationCsv(apps);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    const columns = lines[1].split('","');
    expect(columns).toHaveLength(8);
  });
});
