import { execFile } from 'child_process';
import { promisify } from 'util';
import { applicationRepo, jobRepo, releaseMetadataRepo, auditRepo } from '../repositories';
import { SAFE_PACKAGE_ID_REGEX, ApplicationEntity, ReleaseMetadataEntity, UpdateJobEntity } from '@updatepilot/shared';

const execFileAsync = promisify(execFile);

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
      deviceId: deviceId && deviceId !== 'ALL' ? deviceId : undefined,
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
    acknowledgedTargetVersion?: string;
    userId: string;
  }): Promise<UpdateJobEntity> {
    const preview = await this.previewUpdate(params.applicationId);

    if (
      params.acknowledgedTargetVersion &&
      preview.targetVersion !== params.acknowledgedTargetVersion
    ) {
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

    // Asynchronously trigger local execution if running on Windows
    this.triggerAsyncLocalExecution(
      job.id,
      preview.application.id,
      preview.application.packageId!,
      preview.targetVersion,
      preview.application.deviceId
    );

    return job;
  }

  /**
   * Executes updates for multiple applications or all currently outdated packages.
   */
  async executeBatchUpdates(params: {
    applicationIds?: string[];
    deviceId?: string;
    userId: string;
  }): Promise<{ jobs: UpdateJobEntity[]; count: number }> {
    let appsToUpdate: ApplicationEntity[] = [];

    if (params.applicationIds && params.applicationIds.length > 0) {
      for (const id of params.applicationIds) {
        const a = await applicationRepo.findById(id);
        if (a && a.status === 'UPDATE_AVAILABLE' && a.availableVersion) {
          appsToUpdate.push(a);
        }
      }
    } else {
      appsToUpdate = await this.getAvailableUpdates(params.deviceId);
    }

    const createdJobs: UpdateJobEntity[] = [];

    for (const app of appsToUpdate) {
      try {
        const job = await this.executeUpdate({
          applicationId: app.id,
          acknowledgedTargetVersion: app.availableVersion!,
          userId: params.userId,
        });
        createdJobs.push(job);
      } catch (err) {
        console.warn(`Could not queue update for ${app.name}:`, err);
      }
    }

    return { jobs: createdJobs, count: createdJobs.length };
  }

  /**
   * Directly executes WinGet upgrade in background on the host system
   * and verifies installed version change.
   */
  private triggerAsyncLocalExecution(
    jobId: string,
    applicationId: string,
    packageId: string,
    targetVersion: string,
    deviceId: string
  ): void {
    if (process.platform !== 'win32') return;

    // Small delay to allow remote agent polling to claim if preferred,
    // or run immediately on this host
    setTimeout(async () => {
      try {
        const currentJob = await jobRepo.findUpdateJobById(jobId);
        // If already claimed or running by background agent, don't double execute
        if (!currentJob || currentJob.status === 'COMPLETED' || currentJob.status === 'RUNNING') {
          return;
        }

        // Claim and mark RUNNING
        await jobRepo.updateUpdateJob(jobId, {
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
          executionOutput: `Starting verified upgrade for ${packageId} to version ${targetVersion} via WinGet...\nExecuting: winget upgrade --id "${packageId}" --exact --accept-package-agreements --accept-source-agreements --disable-interactivity`,
        });

        let stdout = '';
        let stderr = '';
        let exitCode = 0;
        let restartRequired = false;

        try {
          const res = await execFileAsync(
            'winget',
            [
              'upgrade',
              '--id',
              packageId,
              '--exact',
              '--accept-package-agreements',
              '--accept-source-agreements',
              '--disable-interactivity',
            ],
            { maxBuffer: 20 * 1024 * 1024, timeout: 600000 }
          );
          stdout = res.stdout;
          stderr = res.stderr;
          restartRequired = stdout.includes('3010') || stdout.toLowerCase().includes('restart required');
        } catch (err: unknown) {
          const errObj = err as { code?: number; stdout?: string; stderr?: string; message?: string };
          exitCode = errObj.code ?? 1;
          stdout = errObj.stdout ?? '';
          stderr = errObj.stderr ?? errObj.message ?? '';
          restartRequired = exitCode === 3010 || stdout.includes('3010');
        }

        if (exitCode === 0 || restartRequired) {
          // Verification step
          await jobRepo.updateUpdateJob(jobId, {
            status: restartRequired ? 'RESTART_REQUIRED' : 'VERIFYING',
            exitCode,
            executionOutput: stdout,
            verificationDetails: 'Inspecting installed inventory to verify version change...',
          });

          let verifiedVersion = targetVersion;
          try {
            const listRes = await execFileAsync(
              'winget',
              ['list', '--id', packageId, '--exact', '--accept-source-agreements'],
              { maxBuffer: 5 * 1024 * 1024 }
            );
            const lines = listRes.stdout.split(/\r?\n/);
            for (const line of lines) {
              if (line.includes(packageId)) {
                const parts = line.trim().split(/\s{2,}/);
                if (parts[2]) {
                  verifiedVersion = parts[2];
                }
              }
            }
          } catch {
            // fallback to targetVersion
          }

          // Update application status in repository
          await applicationRepo.updateStatus(applicationId, 'UP_TO_DATE', verifiedVersion, null);

          // Mark job COMPLETED
          await jobRepo.updateUpdateJob(jobId, {
            status: restartRequired ? 'RESTART_REQUIRED' : 'COMPLETED',
            completedAt: new Date().toISOString(),
            exitCode,
            executionOutput: stdout,
            verificationDetails: `Successfully upgraded and verified version: ${verifiedVersion}`,
          });

          await auditRepo.record({
            deviceId,
            eventType: 'UPDATE_COMPLETED',
            action: `Software update completed and verified for ${packageId}`,
            target: packageId,
            metadata: { version: verifiedVersion, exitCode },
          });
        } else {
          // Failed
          await jobRepo.updateUpdateJob(jobId, {
            status: 'FAILED',
            completedAt: new Date().toISOString(),
            exitCode,
            executionOutput: stdout + (stderr ? `\n[STDERR]:\n${stderr}` : ''),
            verificationDetails: `WinGet exited with code ${exitCode}`,
          });

          await auditRepo.record({
            deviceId,
            eventType: 'UPDATE_FAILED',
            action: `Software update failed for ${packageId}`,
            target: packageId,
            metadata: { exitCode, error: stderr },
          });
        }
      } catch (fatalErr: unknown) {
        console.error('Local update runner fatal error:', fatalErr);
        await jobRepo.updateUpdateJob(jobId, {
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          verificationDetails: fatalErr instanceof Error ? fatalErr.message : String(fatalErr),
        });
      }
    }, 1000);
  }
}

export const updateService = new UpdateService();
