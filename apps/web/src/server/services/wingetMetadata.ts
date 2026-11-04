import { execFile } from 'child_process';
import { promisify } from 'util';
import { ReleaseMetadataEntity } from '@updatepilot/shared';
import { releaseMetadataRepo } from '../repositories';

const execFileAsync = promisify(execFile);

/**
 * Fetches official package metadata (version, publisher, changelog URL, license, SHA-256)
 * from the live WinGet catalog on Windows, caching it in the releaseMetadata repository.
 */
export async function getOrFetchReleaseMetadata(
  packageId: string,
  targetVersion?: string
): Promise<ReleaseMetadataEntity | null> {
  // 1. Check repository cache first
  const cached = await releaseMetadataRepo.findByPackageId(packageId);
  if (cached && (cached.sha256 || process.env.NODE_ENV === 'test')) {
    return cached;
  }

  // 2. Query live WinGet catalog on Windows (skip external network calls in automated tests)
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'test') {
    return cached || null;
  }

  try {
    const res = await execFileAsync(
      'winget',
      ['show', '--id', packageId, '--exact', '--accept-source-agreements'],
      { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
    );

    const stdout = res.stdout;
    if (!stdout || !stdout.includes(packageId)) {
      return cached || null;
    }

    let latestVersion = targetVersion || cached?.latestVersion || '';
    let publisherUrl: string | null = cached?.publisherUrl || null;
    let releaseNotesUrl: string | null = cached?.releaseNotesUrl || null;
    let license: string | null = cached?.license || null;
    let installerType: string | null = cached?.installerType || null;
    let sha256: string | null = cached?.sha256 || null;
    let releaseDate: string | null = cached?.releaseDate || null;

    const lines = stdout.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('Version:')) {
        const v = line.replace('Version:', '').trim();
        if (v) latestVersion = v;
      } else if (line.startsWith('Publisher Url:')) {
        publisherUrl = line.replace('Publisher Url:', '').trim() || publisherUrl;
      } else if (line.startsWith('Release Notes Url:')) {
        releaseNotesUrl = line.replace('Release Notes Url:', '').trim() || releaseNotesUrl;
      } else if (line.startsWith('License:')) {
        license = line.replace('License:', '').trim() || license;
      } else if (line.startsWith('Installer Type:')) {
        installerType = line.replace('Installer Type:', '').trim() || installerType;
      } else if (line.startsWith('Installer SHA256:')) {
        sha256 = line.replace('Installer SHA256:', '').trim() || sha256;
      } else if (line.startsWith('Release Date:')) {
        releaseDate = line.replace('Release Date:', '').trim() || releaseDate;
      }
    }

    if (!latestVersion) {
      latestVersion = targetVersion || 'latest';
    }

    const metadata: ReleaseMetadataEntity = {
      packageId,
      latestVersion,
      publisherUrl,
      releaseNotesUrl,
      license,
      installerType,
      sha256,
      releaseDate,
    };

    // Cache the verified metadata
    await releaseMetadataRepo.upsert(metadata);
    return metadata;
  } catch {
    // If winget show fails or times out, gracefully fallback to cached or null
    return cached || null;
  }
}
