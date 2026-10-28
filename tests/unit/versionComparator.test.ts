import { describe, it, expect } from 'vitest';
import {
  compareVersions,
  isUpdateAvailable,
  cleanVersionString,
  parseVersion,
} from '../../packages/shared/src/utils/versionComparator';

describe('Version Comparator Utility', () => {
  it('correctly cleans version strings', () => {
    expect(cleanVersionString('v8.9.8.1')).toBe('8.9.8.1');
    expect(cleanVersionString(' 128.0.1 (x64 en-US) ')).toBe('128.0.1');
    expect(cleanVersionString('1.2.3-beta.1+build100')).toBe('1.2.3');
  });

  it('identifies identical versions', () => {
    expect(compareVersions('8.8.3', '8.8.3')).toBe(0);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2024.1.0.0', '2024.1.0.0')).toBe(0);
    expect(compareVersions('1.0.0+build1', '1.0.0+build2')).toBe(0);
    expect(isUpdateAvailable('8.8.3', '8.8.3')).toBe(false);
  });

  it('detects available updates (installed < available)', () => {
    // SemVer updates
    expect(compareVersions('8.8.3', '8.9.8.1')).toBe(-1);
    expect(isUpdateAvailable('8.8.3', '8.9.8.1')).toBe(true);

    // Multi-part Windows versions
    expect(compareVersions('25.06.25.0', '26.08.19.0')).toBe(-1);
    expect(isUpdateAvailable('25.06.25.0', '26.08.19.0')).toBe(true);

    // Minor versions
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(isUpdateAvailable('1.2.3', '1.2.4')).toBe(true);

    // Major versions
    expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
    expect(isUpdateAvailable('1.9.9', '2.0.0')).toBe(true);

    // Date-based versions
    expect(compareVersions('2024-01-01', '2024-02-01')).toBe(-1);
    expect(isUpdateAvailable('2024-01-01', '2024-02-01')).toBe(true);
  });

  it('identifies when installed is newer (installed > available)', () => {
    expect(compareVersions('9.0.0', '8.9.8.1')).toBe(1);
    expect(isUpdateAvailable('9.0.0', '8.9.8.1')).toBe(false);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('2024-05-10', '2024-01-01')).toBe(1);
  });

  it('correctly compares SemVer 2.0 prerelease identifiers', () => {
    // Prerelease is lower than stable release of same base
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(isUpdateAvailable('1.0.0-beta.1', '1.0.0')).toBe(true);

    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);

    // Prerelease precedence: alpha < beta < rc
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1);
    expect(compareVersions('1.0.0-rc.1', '1.0.0-beta.9')).toBe(1);
  });

  it('handles invalid, unknown, or empty inputs gracefully', () => {
    expect(compareVersions(null, '1.0.0')).toBeNull();
    expect(compareVersions('1.0.0', undefined)).toBeNull();
    expect(compareVersions('', '')).toBeNull();
    expect(compareVersions('unknown', '1.0.0')).toBeNull();
    expect(compareVersions('invalid', 'unknown')).toBeNull();
    expect(compareVersions('N/A', '2.0.0')).toBeNull();
    expect(parseVersion('none')).toBeNull();
    expect(parseVersion('current')).toBeNull();
    expect(isUpdateAvailable('unknown', '1.0.0')).toBe(false);
    expect(isUpdateAvailable(null, '1.0.0')).toBe(false);
  });
});
