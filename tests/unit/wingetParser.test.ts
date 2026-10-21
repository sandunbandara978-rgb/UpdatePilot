import { describe, it, expect } from 'vitest';
import { WinGetAdapter } from '../../agent/src/adapters/wingetAdapter';

describe('WinGet Adapter Output Parser', () => {
  const adapter = new WinGetAdapter();

  const sampleListOutput = `
The \`msstore\` source requires that you view agreements before using.

Name                        Id                                        Version    Available  Source
--------------------------------------------------------------------------------------------------
Mozilla Firefox (x64 en-US) ARP\\Machine\\X64\\Mozilla Firefox           157.0.1               
Notepad++ (64-bit x64)      Notepad++.Notepad++                       8.8.3      8.9.8.1    winget
PotPlayer-64 bit            Daum.PotPlayer                            25.06.25.0 26.08.19.0 winget
WinRAR 7.13 (64-bit)        RARLab.WinRAR                             7.13.0     7.23.0     winget
`;

  it('correctly parses fixed-width winget list output', () => {
    const apps = adapter.parseListOutput(sampleListOutput);
    expect(apps).toHaveLength(4);

    // Notepad++ has available update
    const npp = apps.find((a) => a.name.includes('Notepad++'));
    expect(npp).toBeDefined();
    expect(npp?.packageId).toBe('Notepad++.Notepad++');
    expect(npp?.version).toBe('8.8.3');
    expect(npp?.availableVersion).toBe('8.9.8.1');
    expect(npp?.source).toBe('winget');

    // PotPlayer has available update
    const pot = apps.find((a) => a.name.includes('PotPlayer'));
    expect(pot?.packageId).toBe('Daum.PotPlayer');
    expect(pot?.version).toBe('25.06.25.0');
    expect(pot?.availableVersion).toBe('26.08.19.0');

    // Firefox is from ARP, packageId should be filtered out from raw ARP machine path
    const ff = apps.find((a) => a.name.includes('Firefox'));
    expect(ff?.packageId).toBeUndefined();
    expect(ff?.version).toBe('157.0.1');
    expect(ff?.availableVersion).toBeUndefined();
  });

  it('correctly parses winget show output into metadata', () => {
    const sampleShowOutput = `
Found Notepad++ [Notepad++.Notepad++]
Version: 8.9.8.1
Publisher: Notepad++ Team
Publisher Url: https://notepad-plus-plus.org/
Description:
  Notepad++ is a free source code editor and Notepad replacement.
Homepage: https://notepad-plus-plus.org/
License: GPL-3.0-or-later
Release Notes Url: https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.8.1
Installer:
  Installer Type: wix
  Installer SHA256: 0c4f4fe82babd7688f5c1431b1357392491563af6ffedf4e37f5de0bd71babb4
  Release Date: 2026-09-24
`;

    const details = adapter.parseShowOutput('Notepad++.Notepad++', sampleShowOutput);
    expect(details.packageId).toBe('Notepad++.Notepad++');
    expect(details.name).toBe('Notepad++ [Notepad++.Notepad++]');
    expect(details.version).toBe('8.9.8.1');
    expect(details.publisher).toBe('Notepad++ Team');
    expect(details.license).toBe('GPL-3.0-or-later');
    expect(details.releaseNotesUrl).toBe('https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.8.1');
    expect(details.installerType).toBe('wix');
    expect(details.sha256).toBe('0c4f4fe82babd7688f5c1431b1357392491563af6ffedf4e37f5de0bd71babb4');
    expect(details.releaseDate).toBe('2026-09-24');
  });

  it('rejects unsafe package IDs to prevent command injection', async () => {
    const result = await adapter.upgradePackage('evil; rm -rf / ;');
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_PACKAGE_ID');
  });
});
