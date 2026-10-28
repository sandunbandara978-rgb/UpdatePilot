import { jobRepo, applicationRepo, deviceRepo, auditRepo } from '../repositories';
import { deviceService } from './deviceService';
import { DashboardMetrics, JobStatus, UpdateJobEntity } from '@updatepilot/shared';

export class JobService {
  async pollJobForAgent(token: string) {
    const deviceId = await deviceService.verifyAgentToken(token);
    return jobRepo.pollPendingJob(deviceId);
  }

  async claimJobByAgent(token: string, jobId: string) {
    const deviceId = await deviceService.verifyAgentToken(token);
    // Try update job first with device ownership validation
    const claimedUpdate = await jobRepo.claimJob(jobId, 'UPDATE', deviceId);
    if (claimedUpdate) return { claimed: true };

    const claimedScan = await jobRepo.claimJob(jobId, 'SCAN', deviceId);
    return { claimed: claimedScan };
  }

  async reportJobByAgent(
    token: string,
    jobId: string,
    report: {
      status: 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'RESTART_REQUIRED';
      exitCode?: number;
      logs?: string;
      verifiedVersion?: string;
      errorDetails?: string;
    }
  ) {
    const deviceId = await deviceService.verifyAgentToken(token);

    // Check if it's an update job
    const updateJob = await jobRepo.findUpdateJobById(jobId);
    if (updateJob) {
      if (updateJob.deviceId !== deviceId) {
        throw new Error(`Forbidden: Device ${deviceId} does not own update job ${jobId}`);
      }

      const updateData: Partial<UpdateJobEntity> = {
        status: report.status as JobStatus,
        exitCode: report.exitCode,
        executionOutput: report.logs,
        verificationDetails: report.verifiedVersion
          ? `Verified version: ${report.verifiedVersion}`
          : report.errorDetails,
      };

      if (report.status === 'COMPLETED') {
        if (!report.verifiedVersion) {
          throw new Error('Verification required: Completed status requires a verifiedVersion.');
        }
        updateData.completedAt = new Date().toISOString();
        // Update the application status to UP_TO_DATE and update installed version
        await applicationRepo.updateStatus(
          updateJob.applicationId,
          'UP_TO_DATE',
          report.verifiedVersion,
          null
        );

        await auditRepo.record({
          deviceId,
          eventType: 'UPDATE_COMPLETED',
          action: `Software update completed and verified for ${updateJob.packageId}`,
          target: updateJob.packageId,
          metadata: { version: report.verifiedVersion },
        });
      } else if (report.status === 'FAILED') {
        updateData.completedAt = new Date().toISOString();
        await auditRepo.record({
          deviceId,
          eventType: 'UPDATE_FAILED',
          action: `Software update failed for ${updateJob.packageId}`,
          target: updateJob.packageId,
          metadata: { exitCode: report.exitCode, error: report.errorDetails },
        });
      }

      await jobRepo.updateUpdateJob(jobId, updateData);
      return { acknowledged: true };
    }

    // Check if it's a scan job
    const scanJob = await jobRepo.findScanJobById(jobId);
    if (scanJob) {
      if (scanJob.deviceId !== deviceId) {
        throw new Error(`Forbidden: Device ${deviceId} does not own scan job ${jobId}`);
      }

      await jobRepo.updateScanJob(jobId, {
        status: report.status as JobStatus,
        errorDetails: report.errorDetails,
        completedAt: report.status === 'COMPLETED' || report.status === 'FAILED' ? new Date().toISOString() : undefined,
      });
      return { acknowledged: true };
    }

    return { acknowledged: false };
  }

  async getJobStatus(jobId: string) {
    const updateJob = await jobRepo.findUpdateJobById(jobId);
    if (updateJob) {
      return { type: 'UPDATE', job: updateJob };
    }
    const scanJob = await jobRepo.findScanJobById(jobId);
    if (scanJob) {
      return { type: 'SCAN', job: scanJob };
    }
    return null;
  }

  async getDashboardMetrics(deviceId?: string, userId?: string): Promise<DashboardMetrics> {
    const allAppsRes = await applicationRepo.list({
      deviceId: deviceId && deviceId !== 'ALL' ? deviceId : undefined,
      page: 1,
      limit: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    const apps = allAppsRes.items;
    let updatesAvailable = 0;
    let upToDate = 0;
    let unsupported = 0;
    let unknown = 0;

    for (const a of apps) {
      if (a.status === 'UPDATE_AVAILABLE') updatesAvailable++;
      else if (a.status === 'UP_TO_DATE') upToDate++;
      else if (a.status === 'UNSUPPORTED') unsupported++;
      else unknown++;
    }

    const targetUserId = userId || 'usr_default_admin';
    const devices = await deviceRepo.listByUserId(targetUserId);
    const activeDevices = devices.filter((d) => d.status === 'ONLINE');

    const recentActivity = await jobRepo.listRecentJobs(10);

    return {
      totalApplications: allAppsRes.total,
      updatesAvailable,
      upToDate,
      unsupported,
      unknown,
      activeDevicesCount: activeDevices.length,
      lastScanTimestamp: recentActivity.find((a) => a.type === 'SCAN')?.timestamp || new Date().toISOString(),
      recentActivity,
    };
  }

  async getUpdateHistory(page: number = 1, limit: number = 20) {
    return jobRepo.listUpdateHistory(page, limit);
  }
}

export const jobService = new JobService();
