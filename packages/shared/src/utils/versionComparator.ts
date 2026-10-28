/**
 * Professional Multi-Format Version Comparator for Windows Applications.
 * Handles SemVer 2.0, Windows 4-part versions (Major.Minor.Build.Revision),
 * date-based releases, pre-release identifiers, and invalid/unknown strings.
 */

export type VersionComparisonResult = -1 | 0 | 1 | null;

export interface ParsedVersion {
  numericParts: number[];
  prerelease?: string;
}

/**
 * Parses and normalizes a version string into numeric parts and optional pre-release tag.
 * Returns null if the version string is invalid, unparseable, or an explicit non-version token.
 */
export function parseVersion(v: string | null | undefined): ParsedVersion | null {
  if (!v) return null;
  const raw = v.trim();
  if (!raw) return null;

  // Filter out explicit non-version keywords
  const lower = raw.toLowerCase();
  const invalidKeywords = ['unknown', 'invalid', 'n/a', 'na', 'none', 'null', 'undefined', 'current', 'latest'];
  if (invalidKeywords.includes(lower)) {
    return null;
  }

  // Must contain at least one digit
  if (!/\d/.test(raw)) {
    return null;
  }

  // Clean initial leading 'v' or 'v.' and parenthetical comments like (x64 en-US)
  let cleaned = raw
    .replace(/^v(?=\d)/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // Strip build metadata (+build100) according to SemVer 2.0
  const withoutBuild = cleaned.split('+')[0];

  // Handle date-based versions like 2024-05-12 or 2024/05/12
  const isDateSeparated = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(withoutBuild);
  let baseStr = withoutBuild;
  let prerelease: string | undefined = undefined;

  if (isDateSeparated) {
    baseStr = withoutBuild.replace(/[-/]/g, '.');
  } else {
    // Look for pre-release separator '-' or '_'
    const preMatch = withoutBuild.match(/^([0-9.]+)(?:[-_](.+))?$/);
    if (preMatch) {
      baseStr = preMatch[1];
      prerelease = preMatch[2]?.trim();
    } else {
      const parts = withoutBuild.split(/[-_]/);
      baseStr = parts[0];
      if (parts.length > 1) {
        prerelease = parts.slice(1).join('-');
      }
    }
  }

  // Parse numeric parts separated by dot
  const dotParts = baseStr.split('.').filter((p) => p.length > 0);
  const numericParts: number[] = [];

  for (const p of dotParts) {
    const num = parseInt(p.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      numericParts.push(num);
    }
  }

  if (numericParts.length === 0) {
    return null;
  }

  return {
    numericParts,
    prerelease: prerelease ? prerelease.toLowerCase() : undefined,
  };
}

/**
 * Returns the base numerical version string (e.g., '8.9.8.1').
 * Retained for backwards compatibility.
 */
export function cleanVersionString(v: string): string {
  const parsed = parseVersion(v);
  if (!parsed) return '';
  return parsed.numericParts.join('.');
}

/**
 * Compares two pre-release strings according to SemVer 2.0 specification.
 * Identifiers consisting of only digits are compared numerically.
 * Identifiers with letters or hyphens are compared lexically in ASCII sort order.
 */
function comparePrereleases(preA: string, preB: string): number {
  if (preA === preB) return 0;

  const partsA = preA.split('.');
  const partsB = preB.split('.');
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = partsA[i];
    const b = partsB[i];

    if (a === undefined) return -1; // fewer parts has lower precedence
    if (b === undefined) return 1;

    if (a === b) continue;

    const numA = /^\d+$/.test(a) ? parseInt(a, 10) : null;
    const numB = /^\d+$/.test(b) ? parseInt(b, 10) : null;

    if (numA !== null && numB !== null) {
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    } else if (numA !== null && numB === null) {
      return -1; // numeric identifiers have lower precedence than alphanumeric
    } else if (numA === null && numB !== null) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  }

  return 0;
}

/**
 * Compares two software versions.
 * Returns:
 *  -1 : current < available  (update available)
 *   0 : current == available (identical)
 *   1 : current > available  (current is newer/downgrade)
 *  null : one or both versions are unparseable/invalid/unknown
 */
export function compareVersions(
  current: string | null | undefined,
  available: string | null | undefined
): VersionComparisonResult {
  const cParsed = parseVersion(current);
  const aParsed = parseVersion(available);

  if (!cParsed || !aParsed) return null;

  const cParts = cParsed.numericParts;
  const aParts = aParsed.numericParts;
  const maxLength = Math.max(cParts.length, aParts.length);

  // 1. Compare numeric components
  for (let i = 0; i < maxLength; i++) {
    const cPart = cParts[i] ?? 0;
    const aPart = aParts[i] ?? 0;

    if (cPart < aPart) return -1;
    if (cPart > aPart) return 1;
  }

  // 2. Numeric parts are equal: check pre-release precedence (SemVer 2.0 Rule 11)
  // A normal version has greater precedence than a pre-release version.
  if (cParsed.prerelease && !aParsed.prerelease) {
    return -1; // current is prerelease, available is stable => update available
  }
  if (!cParsed.prerelease && aParsed.prerelease) {
    return 1; // current is stable, available is prerelease
  }
  if (cParsed.prerelease && aParsed.prerelease) {
    const preComp = comparePrereleases(cParsed.prerelease, aParsed.prerelease);
    if (preComp < 0) return -1;
    if (preComp > 0) return 1;
    return 0;
  }

  return 0; // identical
}

/**
 * Helper to determine if an update is available.
 */
export function isUpdateAvailable(
  installedVersion: string | null | undefined,
  availableVersion: string | null | undefined
): boolean {
  const result = compareVersions(installedVersion, availableVersion);
  return result === -1;
}
