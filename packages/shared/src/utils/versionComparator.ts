/**
 * Professional Multi-Format Version Comparator for Windows Applications.
 * Handles SemVer, Windows 4-part versions (Major.Minor.Build.Revision),
 * date-based releases, and pre-release identifiers.
 */

export type VersionComparisonResult = -1 | 0 | 1 | null;

export function cleanVersionString(v: string): string {
  if (!v) return '';
  return v
    .trim()
    .replace(/^v/i, '') // strip leading 'v'
    .replace(/\s+/g, '') // strip whitespace
    .replace(/\(.*?\)/g, '') // remove parenthetical tags
    .split(/[-+_]/)[0]; // strip pre-release suffixes for base comparison
}

export function compareVersions(
  current: string | null | undefined,
  available: string | null | undefined
): VersionComparisonResult {
  if (!current || !available) return null;

  const cClean = cleanVersionString(current);
  const aClean = cleanVersionString(available);

  if (cClean === aClean) return 0;

  // Split into dot-separated numerical parts
  const cParts = cClean.split('.').map((p) => {
    const num = parseInt(p.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  });

  const aParts = aClean.split('.').map((p) => {
    const num = parseInt(p.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  });

  if (cParts.length === 0 || aParts.length === 0) {
    return null;
  }

  const maxLength = Math.max(cParts.length, aParts.length);

  for (let i = 0; i < maxLength; i++) {
    const cPart = cParts[i] ?? 0;
    const aPart = aParts[i] ?? 0;

    if (cPart < aPart) return -1; // current < available => update available
    if (cPart > aPart) return 1;  // current > available
  }

  return 0; // identical
}

export function isUpdateAvailable(
  installedVersion: string | null | undefined,
  availableVersion: string | null | undefined
): boolean {
  const result = compareVersions(installedVersion, availableVersion);
  return result === -1;
}
