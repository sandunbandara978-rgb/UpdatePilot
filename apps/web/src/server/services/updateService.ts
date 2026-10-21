import { applicationRepo, jobRepo, releaseMetadataRepo, auditRepo } from '../repositories';
import { SAFE_PACKAGE_ID_REGEX, ApplicationEntity, ReleaseMetadataEntity, UpdateJobEntity } from '@updatepilot/shared';

export interface UpdatePreviewResult {
  application: ApplicationEntity;
  metadata: ReleaseMetadataEntity | null;
  targetVersion: string;
  source: string;
  isAllowlisted: boolean;
  warnings: string[];
}

export class UpdateService {
  async getAvailableUpdates(deviceId?: string): Promise<ApplicationEntity[]> {
    const res = await applicationRepo.list({
      deviceId,
      status: 'UPDATE_AVAILABLE',
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    return res.items;
  }

  async previewUpdate(applicationId: string): Promise<UpdatePreviewResult> {
    const app = await applicationRepo.findById(applicationId);
    if (!app) {
      throw new Error(`Application with ID "${applicationId}" not found.`);
    }

    if (!app.packageId || !SAFE_PACKAGE_ID_REGEX.test(app.packageId)) {
      throw new Error(`Package ID "${app.packageId}" is not a valid trusted package identity.`);
    }

    if (!app.availableVersion) {
      throw new Error(`No available update version recorded for "${app.name}".`);
    }

    const metadata = await releaseMetadataRepo.findByPackageId(app.packageId);

    const warnings: string[] = [];
    if (!metadata?.sha256) {
      warnings.push('Installer checksum (SHA-256) was not provided by upstream metadata catalog.');
    }
    if (!metadata?.releaseNotesUrl) {
      warnings.push('Official changelog URL was not provided.');
    }

    return {
      application: app,
      metadata,
      targetVersion: app.availableVersion,
      source: app.source || 'winget',
      isAllowlisted: true,
      warnings,
    };
  }

  async executeUpdate(params: {
    applicationId: string;
    acknowledgedTargetVersion: string;
    userId: string;
  }): Promise<UpdateJobEntity> {
    const preview = await this.previewUpdate(params.applicationId);

    if (preview.targetVersion !== params.acknowledgedTargetVersion) {
      throw new Error(
        `Version mismatch: The acknowledged version (${params.acknowledgedTargetVersion}) does not match the latest verified target version (${preview.targetVersion}).`
      );
    }

    // Create persistent UpdateJob
    const job = await jobRepo.createUpdateJob({
      deviceId: preview.application.deviceId,
      applicationId: preview.application.id,
      packageId: preview.application.packageId!,
      currentVersion: preview.application.installedVersion,
      targetVersion: preview.targetVersion,
    });

    await auditRepo.record({
      userId: params.userId,
      deviceId: preview.application.deviceId,
      eventType: 'UPDATE_CONFIRMED',
      action: `Approved update for ${preview.application.name} to v${preview.targetVersion}`,
      target: preview.application.packageId!,
      metadata: { jobId: job.id, targetVersion: preview.targetVersion },
    });

    return job;
  }
}

export const updateService = new UpdateService();
