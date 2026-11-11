import { applicationRepo, securityRepo, auditRepo, deviceRepo, appHistoryRepo } from '../repositories';
import { getOrFetchReleaseMetadata } from './wingetMetadata';
import { deviceService } from './deviceService';
import {
  compareVersions,
  ApplicationEntity,
  ApplicationStatus,
  ReleaseMetadataEntity,
  SecurityFindingEntity,
  ApplicationHistoryEntity,
} from '@updatepilot/shared';

export interface ApplicationDetailResponse {
  application: ApplicationEntity;
  metadata: ReleaseMetadataEntity | null;
  securityFindings: SecurityFindingEntity[];
  history: ApplicationHistoryEntity[];
}

export class ApplicationService {
  async listApplications(params: {
    userId?: string;
    deviceId?: string;
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number; page: number; totalPages: number }> {
    let deviceIds: string[] | undefined;

    if (params.userId) {
      const userDevices = await deviceRepo.listByUserId(params.userId);
      const ownedIds = userDevices.map((d) => d.id);

      if (params.deviceId && params.deviceId !== 'ALL') {
        if (!ownedIds.includes(params.deviceId)) {
          throw new Error('Forbidden: Access denied to device applications.');
        }
      } else {
        deviceIds = ownedIds;
        if (deviceIds.length === 0) {
          return { items: [], total: 0, page: params.page, totalPages: 1 };
        }
      }
    }

    const { items, total } = await applicationRepo.list({
      deviceId: params.deviceId && params.deviceId !== 'ALL' ? params.deviceId : undefined,
      deviceIds,
      search: params.search,
      status: params.status,
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
    const totalPages = Math.ceil(total / params.limit) || 1;
    return { items, total, page: params.page, totalPages };
  }

  async getApplicationDetails(id: string, userId?: string): Promise<ApplicationDetailResponse | null> {
    const app = await applicationRepo.findById(id);
    if (!app) return null;

    if (userId) {
      await deviceService.assertDeviceOwnership(app.deviceId, userId);
    }

    let metadata: ReleaseMetadataEntity | null = null;
    let securityFindings: SecurityFindingEntity[] = [];

    if (app.packageId) {
      metadata = await getOrFetchReleaseMetadata(app.packageId, app.availableVersion || undefined);
      securityFindings = await securityRepo.listByPackageId(app.packageId);
    }

    const history = await appHistoryRepo.listByApplicationId(app.id);

    return {
      application: app,
      metadata,
      securityFindings,
      history,
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
          status = 'UP_TO_DATE';
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
