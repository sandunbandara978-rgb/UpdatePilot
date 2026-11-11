import { jobRepo, applicationRepo, deviceRepo, auditRepo, appHistoryRepo } from '../repositories';
import { deviceService } from './deviceService';
import { DashboardMetrics, JobStatus, UpdateJobEntity } from '@updatepilot/shared';

export class JobService {
  async pollJobForAgent(token: string) {
    const deviceId = await deviceService.verifyAgentToken(token);
    return jobRepo.pollPendingJob(deviceId);
  }

  async claimJobByAgent(token: string, jobId: string) {
    const deviceId = await deviceService.verifyAgentToken(token);
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
        await applicationRepo.updateStatus(
          updateJob.applicationId,
          'UP_TO_DATE',
          report.verifiedVersion,
          null
        );

        await appHistoryRepo.record({
          applicationId: updateJob.applicationId,
          previousVersion: updateJob.currentVersion,
          newVersion: report.verifiedVersion,
          triggerType: 'AGENT_UPDATE',
        });

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

  async getJobStatus(jobId: string, userId?: string) {
    const updateJob = await jobRepo.findUpdateJobById(jobId);
    if (updateJob) {
      if (userId) {
        await deviceService.assertDeviceOwnership(updateJob.deviceId, userId);
      }
      return { type: 'UPDATE' as const, job: updateJob };
    }
    const scanJob = await jobRepo.findScanJobById(jobId);
    if (scanJob) {
      if (userId) {
        await deviceService.assertDeviceOwnership(scanJob.deviceId, userId);
      }
      return { type: 'SCAN' as const, job: scanJob };
    }
    return null;
  }

  async getDashboardMetrics(deviceId?: string, userId?: string): Promise<DashboardMetrics> {
    const targetUserId = userId || 'usr_default_admin';
    const devices = await deviceRepo.listByUserId(targetUserId);
    const ownedDeviceIds = devices.map((d) => d.id);

    if (deviceId && deviceId !== 'ALL' && !ownedDeviceIds.includes(deviceId)) {
      throw new Error('Forbidden: Access denied to device metrics.');
    }

    let apps: Array<{ status: string }> = [];
    let totalApplications = 0;

    if (ownedDeviceIds.length > 0) {
      const allAppsRes = await applicationRepo.list({
        deviceId: deviceId && deviceId !== 'ALL' ? deviceId : undefined,
        deviceIds: deviceId && deviceId !== 'ALL' ? undefined : ownedDeviceIds,
        page: 1,
        limit: 1000,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      apps = allAppsRes.items;
      totalApplications = allAppsRes.total;
    }

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

    const activeDevices = devices.filter((d) => d.status === 'ONLINE');
    const recentActivity = ownedDeviceIds.length > 0
      ? await jobRepo.listRecentJobs(10, deviceId && deviceId !== 'ALL' ? [deviceId] : ownedDeviceIds)
      : [];

    return {
      totalApplications,
      updatesAvailable,
      upToDate,
      unsupported,
      unknown,
      activeDevicesCount: activeDevices.length,
      lastScanTimestamp: recentActivity.find((a) => a.type === 'SCAN')?.timestamp || null,
      recentActivity,
    };
  }

  async getUpdateHistory(page: number = 1, limit: number = 20, userId?: string) {
    if (userId) {
      const devices = await deviceRepo.listByUserId(userId);
      const deviceIds = devices.map((d) => d.id);
      if (deviceIds.length === 0) {
        return { items: [], total: 0 };
      }
      return jobRepo.listUpdateHistory(page, limit, deviceIds);
    }
    return jobRepo.listUpdateHistory(page, limit);
  }
}

export const jobService = new JobService();
