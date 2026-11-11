import { applicationRepo, deviceRepo, securityRepo } from '../repositories';
import { SecurityFindingEntity } from '@updatepilot/shared';

/**
 * Deterministic WinGet Package ID -> Official NVD CPE 2.3 vendor:product mapping.
 * Strictly curated: never guesses or synthesizes vulnerability matches for unknown software.
 */
const VERIFIED_CPE_MAP: Record<string, { vendor: string; product: string }> = {
  'git.git': { vendor: 'git-scm', product: 'git' },
  'notepad++.notepad++': { vendor: 'notepad-plus-plus', product: 'notepad++' },
  'rarlab.winrar': { vendor: 'rarlab', product: 'winrar' },
  'videolan.vlc': { vendor: 'videolan', product: 'vlc_media_player' },
  '7zip.7zip': { vendor: '7-zip', product: '7-zip' },
  'openjs.nodejs': { vendor: 'nodejs', product: 'node.js' },
  'openjs.nodejs.lts': { vendor: 'nodejs', product: 'node.js' },
  'mozilla.firefox': { vendor: 'mozilla', product: 'firefox' },
  'google.chrome': { vendor: 'google', product: 'chrome' },
  'microsoft.visualstudiocode': { vendor: 'microsoft', product: 'visual_studio_code' },
  'obsproject.obsstudio': { vendor: 'obsproject', product: 'obs_studio' },
};

function normalizeVersionForCpe(rawVersion: string): string | null {
  const cleaned = rawVersion.trim().replace(/^v/i, '').split(/\s+/)[0];
  if (!/^[0-9]+(\.[0-9]+)*$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function mapCvssSeverity(score?: number, rawSeverity?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const sev = (rawSeverity || '').toUpperCase();
  if (sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW') {
    return sev;
  }
  if (typeof score === 'number') {
    if (score >= 9.0) return 'CRITICAL';
    if (score >= 7.0) return 'HIGH';
    if (score >= 4.0) return 'MEDIUM';
  }
  return 'LOW';
}

export interface SecurityQueryResult {
  findings: SecurityFindingEntity[];
  lastCheckedAt: string;
  source: string;
  advisoryFeedStatus: 'VERIFIED_LIVE' | 'CACHED' | 'UNAVAILABLE' | 'NO_MATCHABLE_PACKAGES';
  checkedPackagesCount: number;
  disclaimer: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let lastNvdSyncAt = 0;

export class SecurityService {
  async getSecurityFindingsForUser(
    userId: string,
    options?: { forceRefresh?: boolean; deviceId?: string }
  ): Promise<SecurityQueryResult> {
    const devices = await deviceRepo.listByUserId(userId);
    const ownedIds = devices.map((d) => d.id);

    if (options?.deviceId && options.deviceId !== 'ALL' && !ownedIds.includes(options.deviceId)) {
      throw new Error('Forbidden: Access denied to device security findings.');
    }

    const appsRes =
      ownedIds.length > 0
        ? await applicationRepo.list({
          deviceId: options?.deviceId && options.deviceId !== 'ALL' ? options.deviceId : undefined,
          deviceIds: options?.deviceId && options.deviceId !== 'ALL' ? undefined : ownedIds,
          page: 1,
          limit: 500,
          sortBy: 'name',
          sortOrder: 'asc',
        })
        : { items: [], total: 0 };

    // Identify unique installed apps with verified CPE mappings
    const targets: Array<{ packageId: string; cpeName: string; version: string; fixedVersion?: string | null }> = [];
    const seenKeys = new Set<string>();

    for (const app of appsRes.items) {
      if (!app.packageId) continue;
      const mapping = VERIFIED_CPE_MAP[app.packageId.toLowerCase()];
      if (!mapping) continue;

      const cpeVer = normalizeVersionForCpe(app.installedVersion);
      if (!cpeVer) continue;

      const key = `${app.packageId.toLowerCase()}@${cpeVer}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      targets.push({
        packageId: app.packageId,
        cpeName: `cpe:2.3:a:${mapping.vendor}:${mapping.product}:${cpeVer}:*:*:*:*:*:*:*`,
        version: app.installedVersion,
        fixedVersion: app.availableVersion || null,
      });
    }

    const disclaimer =
      'Vulnerability intelligence is matched strictly against verified package identifiers and official NIST NVD CPE records. Proprietary software or packages without deterministic upstream mappings are intentionally excluded rather than guessed.';

    if (targets.length === 0) {
      return {
        findings: [],
        lastCheckedAt: new Date().toISOString(),
        source: 'NIST National Vulnerability Database (NVD API v2)',
        advisoryFeedStatus: 'NO_MATCHABLE_PACKAGES',
        checkedPackagesCount: 0,
        disclaimer,
      };
    }

    const targetPackageIds = Array.from(new Set(targets.map((t) => t.packageId)));
    const isCacheFresh = !options?.forceRefresh && Date.now() - lastNvdSyncAt < CACHE_TTL_MS;

    if (isCacheFresh) {
      const cached = await securityRepo.listForPackageIds(targetPackageIds);
      return {
        findings: cached,
        lastCheckedAt: new Date(lastNvdSyncAt || Date.now()).toISOString(),
        source: 'NIST National Vulnerability Database (NVD API v2)',
        advisoryFeedStatus: 'CACHED',
        checkedPackagesCount: targets.length,
        disclaimer,
      };
    }

    // Query live NVD API v2 (bounded concurrency & timeout so serverless routes stay responsive)
    const collectedFindings: Array<Omit<SecurityFindingEntity, 'id'>> = [];
    let anyNetworkSucceeded = false;

    const nvdBaseUrl = process.env.NVD_API_URL || 'https://services.nvd.nist.gov/rest/json/cves/2.0';
    const limitedTargets = targets.slice(0, 6);

    for (const target of limitedTargets) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `${nvdBaseUrl}?cpeName=${encodeURIComponent(target.cpeName)}&resultsPerPage=5`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'UpdatePilot/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) continue;
        anyNetworkSucceeded = true;

        const payload = (await res.json()) as {
          vulnerabilities?: Array<{
            cve?: {
              id?: string;
              published?: string;
              descriptions?: Array<{ lang?: string; value?: string }>;
              metrics?: {
                cvssMetricV31?: Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }>;
                cvssMetricV30?: Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }>;
                cvssMetricV2?: Array<{ baseSeverity?: string; cvssData?: { baseScore?: number } }>;
              };
            };
          }>;
        };

        for (const item of payload.vulnerabilities || []) {
          const cve = item.cve;
          if (!cve?.id) continue;

          const enDesc =
            cve.descriptions?.find((d) => d.lang === 'en')?.value ||
            cve.descriptions?.[0]?.value ||
            'Published NVD security vulnerability affecting this installed version.';

          const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
          const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
          const v2 = cve.metrics?.cvssMetricV2?.[0];

          const severity = mapCvssSeverity(
            v31?.baseScore ?? v30?.baseScore ?? v2?.cvssData?.baseScore,
            v31?.baseSeverity ?? v30?.baseSeverity ?? v2?.baseSeverity
          );

          collectedFindings.push({
            packageId: target.packageId,
            cveId: cve.id,
            summary: enDesc.length > 360 ? `${enDesc.slice(0, 357)}...` : enDesc,
            severity,
            affectedVersions: `== ${target.version}`,
            fixedVersion: target.fixedVersion || null,
            advisoryUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
            publishedAt: cve.published || new Date().toISOString(),
          });
        }
      } catch {
        // Network timeout or NVD rate-limit: degrade gracefully
      }
    }

    if (anyNetworkSucceeded) {
      lastNvdSyncAt = Date.now();
      await securityRepo.replaceForPackages(targetPackageIds, collectedFindings);
      const saved = await securityRepo.listForPackageIds(targetPackageIds);
      return {
        findings: saved,
        lastCheckedAt: new Date(lastNvdSyncAt).toISOString(),
        source: 'NIST National Vulnerability Database (NVD API v2)',
        advisoryFeedStatus: 'VERIFIED_LIVE',
        checkedPackagesCount: limitedTargets.length,
        disclaimer,
      };
    }

    // Fallback to previously persisted findings if NVD was unreachable
    const existing = await securityRepo.listForPackageIds(targetPackageIds);
    return {
      findings: existing,
      lastCheckedAt: new Date(lastNvdSyncAt || Date.now()).toISOString(),
      source: 'NIST National Vulnerability Database (NVD API v2)',
      advisoryFeedStatus: existing.length > 0 ? 'CACHED' : 'UNAVAILABLE',
      checkedPackagesCount: limitedTargets.length,
      disclaimer,
    };
  }
}

export const securityService = new SecurityService();

