import { applicationRepo, releaseMetadataRepo, securityRepo, auditRepo } from '../repositories';
import { deviceService } from './deviceService';
import { compareVersions, ApplicationEntity, ApplicationStatus, ReleaseMetadataEntity, SecurityFindingEntity } from '@updatepilot/shared';

export interface ApplicationDetailResponse {
  application: ApplicationEntity;
  metadata: ReleaseMetadataEntity | null;
  securityFindings: SecurityFindingEntity[];
}

export class ApplicationService {
  async listApplications(params: {
    deviceId?: string;
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number; page: number; totalPages: number }> {
    const { items, total } = await applicationRepo.list(params);
    const totalPages = Math.ceil(total / params.limit) || 1;
    return { items, total, page: params.page, totalPages };
  }

  async getApplicationDetails(id: string): Promise<ApplicationDetailResponse | null> {
    const app = await applicationRepo.findById(id);
    if (!app) return null;

    let metadata: ReleaseMetadataEntity | null = null;
    let securityFindings: SecurityFindingEntity[] = [];

    if (app.packageId) {
      metadata = await releaseMetadataRepo.findByPackageId(app.packageId);
      securityFindings = await securityRepo.listByPackageId(app.packageId);
    }

    return {
      application: app,
      metadata,
      securityFindings,
    };
  }

  async submitScanResults(
    agentToken: string,
    scanJobId: string,
    discoveredApps: Array<{
      name: string;
      packageId?: string | null;
      publisher?: string | null;
      installedVersion: string;
      availableVersion?: string | null;
      source?: string | null;
    }>
  ): Promise<{ appsSaved: number; updatesCount: number }> {
    const deviceId = await deviceService.verifyAgentToken(agentToken);

    let updatesCount = 0;
    const processedApps = discoveredApps.map((raw) => {
      let status: ApplicationStatus = 'UP_TO_DATE';

      if (!raw.packageId) {
        status = raw.source === 'local_registry' ? 'UNMATCHED' : 'UNSUPPORTED';
      } else if (raw.availableVersion) {
        const cmp = compareVersions(raw.installedVersion, raw.availableVersion);
        if (cmp === -1) {
          status = 'UPDATE_AVAILABLE';
          updatesCount++;
        } else if (cmp === 0) {
          status = 'UP_TO_DATE';
        } else if (cmp === 1) {
          status = 'UP_TO_DATE'; // installed is newer (e.g. dev build or beta)
        } else {
          status = 'UNKNOWN_VERSION';
        }
      } else {
        status = 'UP_TO_DATE';
      }

      return {
        name: raw.name,
        packageId: raw.packageId || null,
        publisher: raw.publisher || null,
        installedVersion: raw.installedVersion,
        availableVersion: raw.availableVersion || null,
        source: raw.source || (raw.packageId ? 'winget' : null),
        status,
      };
    });

    const appsSaved = await applicationRepo.upsertMany(deviceId, processedApps);

    await auditRepo.record({
      deviceId,
      eventType: 'SCAN_COMPLETED',
      action: 'Synchronized software inventory from agent scan',
      target: `Job ${scanJobId}`,
      metadata: { appsSaved, updatesCount },
    });

    return { appsSaved, updatesCount };
  }
}

export const applicationService = new ApplicationService();
