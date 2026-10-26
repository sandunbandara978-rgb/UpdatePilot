import { prisma } from '../db';
import {
  ApplicationEntity,
  DeviceEntity,
  ScanJobEntity,
  UpdateJobEntity,
  AuditEventEntity,
  ReleaseMetadataEntity,
  SecurityFindingEntity,
  ApplicationStatus,
  JobStatus,
} from '@updatepilot/shared';
import {
  IDeviceRepository,
  IApplicationRepository,
  IJobRepository,
  IAuditRepository,
  IReleaseMetadataRepository,
  ISecurityRepository,
} from './types';
import { SecurityAuth } from '../security/auth';

function getPrisma() {
  if (!prisma) {
    throw new Error('Prisma client is not initialized. Ensure DATABASE_URL is set.');
  }
  return prisma;
}

export class PrismaDeviceRepository implements IDeviceRepository {
  async findById(id: string): Promise<DeviceEntity | null> {
    const db = getPrisma();
    const d = await db.device.findUnique({ where: { id } });
    if (!d) return null;
    return {
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osVersion: d.osVersion,
      osBuild: d.osBuild || undefined,
      agentVersion: d.agentVersion,
      status: d.status as any,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  }

  async findByPairingCode(code: string): Promise<DeviceEntity | null> {
    const db = getPrisma();
    const d = await db.device.findFirst({
      where: {
        pairingCode: code,
        pairingCodeExpiresAt: { gt: new Date() },
      },
    });
    if (!d) return null;
    return {
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osVersion: d.osVersion,
      osBuild: d.osBuild || undefined,
      agentVersion: d.agentVersion,
      status: d.status as any,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  }

  async listByUserId(userId: string): Promise<DeviceEntity[]> {
    const db = getPrisma();
    const list = await db.device.findMany({ where: { userId } });
    return list.map((d) => ({
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osVersion: d.osVersion,
      osBuild: d.osBuild || undefined,
      agentVersion: d.agentVersion,
      status: d.status as any,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async create(data: Omit<DeviceEntity, 'id' | 'createdAt'>): Promise<DeviceEntity> {
    const db = getPrisma();
    const d = await db.device.create({
      data: {
        userId: data.userId,
        deviceName: data.deviceName,
        osVersion: data.osVersion,
        osBuild: data.osBuild,
        agentVersion: data.agentVersion,
        status: data.status,
      },
    });
    return {
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osVersion: d.osVersion,
      osBuild: d.osBuild || undefined,
      agentVersion: d.agentVersion,
      status: d.status as any,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  }

  async update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity> {
    const db = getPrisma();
    const updateData: any = {};
    if (data.deviceName) updateData.deviceName = data.deviceName;
    if (data.osVersion) updateData.osVersion = data.osVersion;
    if (data.osBuild) updateData.osBuild = data.osBuild;
    if (data.agentVersion) updateData.agentVersion = data.agentVersion;
    if (data.status) updateData.status = data.status;
    if (data.lastSeenAt) updateData.lastSeenAt = new Date(data.lastSeenAt);

    const d = await db.device.update({
      where: { id },
      data: updateData,
    });

    return {
      id: d.id,
      userId: d.userId,
      deviceName: d.deviceName,
      osVersion: d.osVersion,
      osBuild: d.osBuild || undefined,
      agentVersion: d.agentVersion,
      status: d.status as any,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  }

  async setPairingCode(id: string, code: string, expiresAt: Date): Promise<void> {
    const db = getPrisma();
    await db.device.update({
      where: { id },
      data: {
        pairingCode: code,
        pairingCodeExpiresAt: expiresAt,
      },
    });
  }

  async createCredential(deviceId: string, tokenHash: string, salt: string): Promise<void> {
    const db = getPrisma();
    await db.agentCredential.create({
      data: {
        deviceId,
        tokenHash,
        salt,
      },
    });
  }

  async findCredentialByToken(token: string): Promise<{ deviceId: string; isRevoked: boolean } | null> {
    const db = getPrisma();
    const creds = await db.agentCredential.findMany({
      where: { isRevoked: false },
    });

    for (const c of creds) {
      if (SecurityAuth.verifyAgentToken(token, c.tokenHash, c.salt)) {
        await db.agentCredential.update({
          where: { id: c.id },
          data: { lastUsedAt: new Date() },
        });
        return { deviceId: c.deviceId, isRevoked: c.isRevoked };
      }
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const db = getPrisma();
    await db.$transaction([
      db.device.update({
        where: { id },
        data: { status: 'REVOKED' },
      }),
      db.agentCredential.updateMany({
        where: { deviceId: id },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);
  }

  async delete(id: string): Promise<void> {
    const db = getPrisma();
    await db.device.delete({ where: { id } });
  }
}

export class PrismaApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<ApplicationEntity | null> {
    const db = getPrisma();
    const a = await db.application.findUnique({ where: { id } });
    if (!a) return null;
    return {
      id: a.id,
      deviceId: a.deviceId,
      name: a.name,
      packageId: a.packageId || undefined,
      publisher: a.publisher || undefined,
      installedVersion: a.installedVersion,
      availableVersion: a.availableVersion || undefined,
      source: a.source || undefined,
      status: a.status as ApplicationStatus,
      lastScannedAt: a.lastScannedAt.toISOString(),
    };
  }

  async findByPackageId(deviceId: string, packageId: string): Promise<ApplicationEntity | null> {
    const db = getPrisma();
    const a = await db.application.findFirst({
      where: { deviceId, packageId },
    });
    if (!a) return null;
    return {
      id: a.id,
      deviceId: a.deviceId,
      name: a.name,
      packageId: a.packageId || undefined,
      publisher: a.publisher || undefined,
      installedVersion: a.installedVersion,
      availableVersion: a.availableVersion || undefined,
      source: a.source || undefined,
      status: a.status as ApplicationStatus,
      lastScannedAt: a.lastScannedAt.toISOString(),
    };
  }

  async list(params: {
    deviceId?: string;
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number }> {
    const db = getPrisma();
    const where: any = {};
    if (params.deviceId) where.deviceId = params.deviceId;
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { packageId: { contains: params.search, mode: 'insensitive' } },
        { publisher: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortField = ['name', 'publisher', 'status', 'lastScannedAt'].includes(params.sortBy)
      ? params.sortBy
      : 'name';
    orderBy[sortField] = params.sortOrder;

    const [items, total] = await Promise.all([
      db.application.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.application.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        id: a.id,
        deviceId: a.deviceId,
        name: a.name,
        packageId: a.packageId || undefined,
        publisher: a.publisher || undefined,
        installedVersion: a.installedVersion,
        availableVersion: a.availableVersion || undefined,
        source: a.source || undefined,
        status: a.status as ApplicationStatus,
        lastScannedAt: a.lastScannedAt.toISOString(),
      })),
      total,
    };
  }

  async upsertMany(
    deviceId: string,
    apps: Array<{
      name: string;
      packageId?: string | null;
      publisher?: string | null;
      installedVersion: string;
      availableVersion?: string | null;
      source?: string | null;
      status: ApplicationStatus;
    }>
  ): Promise<number> {
    const db = getPrisma();
    let count = 0;

    await db.$transaction(async (tx) => {
      for (const app of apps) {
        await tx.application.upsert({
          where: {
            deviceId_name_installedVersion: {
              deviceId,
              name: app.name,
              installedVersion: app.installedVersion,
            },
          },
          update: {
            packageId: app.packageId,
            publisher: app.publisher,
            availableVersion: app.availableVersion,
            source: app.source || 'winget',
            status: app.status,
            lastScannedAt: new Date(),
          },
          create: {
            deviceId,
            name: app.name,
            packageId: app.packageId,
            publisher: app.publisher,
            installedVersion: app.installedVersion,
            availableVersion: app.availableVersion,
            source: app.source || 'winget',
            status: app.status,
            lastScannedAt: new Date(),
          },
        });
        count++;
      }
    });

    return count;
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    installedVersion?: string,
    availableVersion?: string | null
  ): Promise<ApplicationEntity> {
    const db = getPrisma();
    const updateData: any = { status, lastScannedAt: new Date() };
    if (installedVersion) updateData.installedVersion = installedVersion;
    if (availableVersion !== undefined) updateData.availableVersion = availableVersion;

    const a = await db.application.update({
      where: { id },
      data: updateData,
    });

    return {
      id: a.id,
      deviceId: a.deviceId,
      name: a.name,
      packageId: a.packageId || undefined,
      publisher: a.publisher || undefined,
      installedVersion: a.installedVersion,
      availableVersion: a.availableVersion || undefined,
      source: a.source || undefined,
      status: a.status as ApplicationStatus,
      lastScannedAt: a.lastScannedAt.toISOString(),
    };
  }
}

export class PrismaJobRepository implements IJobRepository {
  async findScanJobById(id: string): Promise<ScanJobEntity | null> {
    const db = getPrisma();
    const j = await db.scanJob.findUnique({ where: { id } });
    if (!j) return null;
    return {
      id: j.id,
      deviceId: j.deviceId,
      status: j.status as JobStatus,
      appsDiscovered: j.appsDiscovered,
      updatesDetected: j.updatesDetected,
      errorDetails: j.errorDetails || undefined,
      startedAt: j.startedAt?.toISOString(),
      completedAt: j.completedAt?.toISOString(),
      createdAt: j.createdAt.toISOString(),
    };
  }

  async findUpdateJobById(id: string): Promise<UpdateJobEntity | null> {
    const db = getPrisma();
    const u = await db.updateJob.findUnique({ where: { id } });
    if (!u) return null;
    return {
      id: u.id,
      deviceId: u.deviceId,
      applicationId: u.applicationId,
      packageId: u.packageId,
      currentVersion: u.currentVersion,
      targetVersion: u.targetVersion,
      status: u.status as JobStatus,
      exitCode: u.exitCode ?? undefined,
      executionOutput: u.executionOutput || undefined,
      verificationDetails: u.verificationDetails || undefined,
      scheduledAt: u.scheduledAt?.toISOString(),
      startedAt: u.startedAt?.toISOString(),
      completedAt: u.completedAt?.toISOString(),
      createdAt: u.createdAt.toISOString(),
    };
  }

  async createScanJob(deviceId: string): Promise<ScanJobEntity> {
    const db = getPrisma();
    const j = await db.scanJob.create({
      data: {
        deviceId,
        status: 'QUEUED',
      },
    });
    return {
      id: j.id,
      deviceId: j.deviceId,
      status: j.status as JobStatus,
      appsDiscovered: j.appsDiscovered,
      updatesDetected: j.updatesDetected,
      createdAt: j.createdAt.toISOString(),
    };
  }

  async createUpdateJob(data: {
    deviceId: string;
    applicationId: string;
    packageId: string;
    currentVersion: string;
    targetVersion: string;
  }): Promise<UpdateJobEntity> {
    const db = getPrisma();
    const u = await db.updateJob.create({
      data: {
        deviceId: data.deviceId,
        applicationId: data.applicationId,
        packageId: data.packageId,
        currentVersion: data.currentVersion,
        targetVersion: data.targetVersion,
        status: 'QUEUED',
      },
    });
    return {
      id: u.id,
      deviceId: u.deviceId,
      applicationId: u.applicationId,
      packageId: u.packageId,
      currentVersion: u.currentVersion,
      targetVersion: u.targetVersion,
      status: u.status as JobStatus,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async pollPendingJob(deviceId: string): Promise<{ id: string; type: 'SCAN' | 'UPDATE'; payload: any } | null> {
    const db = getPrisma();
    // Prioritize update jobs over scan jobs
    const updateJob = await db.updateJob.findFirst({
      where: { deviceId, status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    });

    if (updateJob) {
      return {
        id: updateJob.id,
        type: 'UPDATE',
        payload: {
          packageId: updateJob.packageId,
          targetVersion: updateJob.targetVersion,
          currentVersion: updateJob.currentVersion,
        },
      };
    }

    const scanJob = await db.scanJob.findFirst({
      where: { deviceId, status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    });

    if (scanJob) {
      return {
        id: scanJob.id,
        type: 'SCAN',
        payload: {},
      };
    }

    return null;
  }

  async claimJob(id: string, type: 'SCAN' | 'UPDATE'): Promise<boolean> {
    const db = getPrisma();
    if (type === 'SCAN') {
      const res = await db.scanJob.updateMany({
        where: { id, status: 'QUEUED' },
        data: { status: 'CLAIMED', startedAt: new Date() },
      });
      return res.count > 0;
    } else {
      const res = await db.updateJob.updateMany({
        where: { id, status: 'QUEUED' },
        data: { status: 'CLAIMED', startedAt: new Date() },
      });
      return res.count > 0;
    }
  }

  async updateScanJob(id: string, data: Partial<ScanJobEntity>): Promise<void> {
    const db = getPrisma();
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.appsDiscovered !== undefined) updateData.appsDiscovered = data.appsDiscovered;
    if (data.updatesDetected !== undefined) updateData.updatesDetected = data.updatesDetected;
    if (data.errorDetails) updateData.errorDetails = data.errorDetails;
    if (data.startedAt) updateData.startedAt = new Date(data.startedAt);
    if (data.completedAt) updateData.completedAt = new Date(data.completedAt);

    await db.scanJob.update({
      where: { id },
      data: updateData,
    });
  }

  async updateUpdateJob(id: string, data: Partial<UpdateJobEntity>): Promise<void> {
    const db = getPrisma();
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.exitCode !== undefined) updateData.exitCode = data.exitCode;
    if (data.executionOutput !== undefined) updateData.executionOutput = data.executionOutput;
    if (data.verificationDetails !== undefined) updateData.verificationDetails = data.verificationDetails;
    if (data.startedAt) updateData.startedAt = new Date(data.startedAt);
    if (data.completedAt) updateData.completedAt = new Date(data.completedAt);

    await db.updateJob.update({
      where: { id },
      data: updateData,
    });
  }

  async listRecentJobs(limit: number): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>> {
    const db = getPrisma();
    const [scans, updates] = await Promise.all([
      db.scanJob.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.updateJob.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { application: true },
      }),
    ]);

    const combined: Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string; createdAtRaw: Date }> = [];

    scans.forEach((s) => {
      combined.push({
        id: s.id,
        type: 'SCAN',
        title: 'Full Software Discovery Scan',
        status: s.status as JobStatus,
        timestamp: (s.completedAt || s.createdAt).toISOString(),
        details: s.status === 'COMPLETED' ? `Discovered ${s.appsDiscovered} apps, ${s.updatesDetected} updates` : undefined,
        createdAtRaw: s.createdAt,
      });
    });

    updates.forEach((u) => {
      combined.push({
        id: u.id,
        type: 'UPDATE',
        title: `Update ${u.packageId} -> v${u.targetVersion}`,
        status: u.status as JobStatus,
        timestamp: (u.completedAt || u.createdAt).toISOString(),
        details: u.status === 'COMPLETED' ? 'Version verified successfully' : u.executionOutput || undefined,
        createdAtRaw: u.createdAt,
      });
    });

    combined.sort((a, b) => b.createdAtRaw.getTime() - a.createdAtRaw.getTime());
    return combined.slice(0, limit).map(({ id, type, title, status, timestamp, details }) => ({
      id,
      type,
      title,
      status,
      timestamp,
      details,
    }));
  }

  async listUpdateHistory(page: number, limit: number): Promise<{ items: UpdateJobEntity[]; total: number }> {
    const db = getPrisma();
    const [items, total] = await Promise.all([
      db.updateJob.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.updateJob.count(),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        deviceId: u.deviceId,
        applicationId: u.applicationId,
        packageId: u.packageId,
        currentVersion: u.currentVersion,
        targetVersion: u.targetVersion,
        status: u.status as JobStatus,
        exitCode: u.exitCode ?? undefined,
        executionOutput: u.executionOutput || undefined,
        verificationDetails: u.verificationDetails || undefined,
        scheduledAt: u.scheduledAt?.toISOString(),
        startedAt: u.startedAt?.toISOString(),
        completedAt: u.completedAt?.toISOString(),
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  }
}

export class PrismaAuditRepository implements IAuditRepository {
  async record(event: Omit<AuditEventEntity, 'id' | 'createdAt'>): Promise<void> {
    const db = getPrisma();
    await db.auditEvent.create({
      data: {
        userId: event.userId,
        deviceId: event.deviceId,
        eventType: event.eventType,
        action: event.action,
        target: event.target,
        metadata: (event.metadata as any) ?? {},
        ipAddress: event.ipAddress,
      },
    });
  }

  async list(limit: number): Promise<AuditEventEntity[]> {
    const db = getPrisma();
    const list = await db.auditEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((e) => ({
      id: e.id,
      userId: e.userId || undefined,
      deviceId: e.deviceId || undefined,
      eventType: e.eventType as any,
      action: e.action,
      target: e.target,
      metadata: (e.metadata as any) || undefined,
      ipAddress: e.ipAddress || undefined,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export class PrismaReleaseMetadataRepository implements IReleaseMetadataRepository {
  async findByPackageId(packageId: string): Promise<ReleaseMetadataEntity | null> {
    const db = getPrisma();
    const m = await db.releaseMetadata.findUnique({ where: { packageId } });
    if (!m) return null;
    return {
      packageId: m.packageId,
      latestVersion: m.latestVersion,
      publisherUrl: m.publisherUrl || undefined,
      releaseNotesUrl: m.releaseNotesUrl || undefined,
      license: m.license || undefined,
      installerType: m.installerType || undefined,
      sha256: m.sha256 || undefined,
      releaseDate: m.releaseDate?.toISOString(),
    };
  }

  async upsert(metadata: ReleaseMetadataEntity): Promise<void> {
    const db = getPrisma();
    await db.releaseMetadata.upsert({
      where: { packageId: metadata.packageId },
      update: {
        latestVersion: metadata.latestVersion,
        publisherUrl: metadata.publisherUrl,
        releaseNotesUrl: metadata.releaseNotesUrl,
        license: metadata.license,
        installerType: metadata.installerType,
        sha256: metadata.sha256,
        releaseDate: metadata.releaseDate ? new Date(metadata.releaseDate) : null,
        fetchedAt: new Date(),
      },
      create: {
        packageId: metadata.packageId,
        latestVersion: metadata.latestVersion,
        publisherUrl: metadata.publisherUrl,
        releaseNotesUrl: metadata.releaseNotesUrl,
        license: metadata.license,
        installerType: metadata.installerType,
        sha256: metadata.sha256,
        releaseDate: metadata.releaseDate ? new Date(metadata.releaseDate) : null,
        fetchedAt: new Date(),
      },
    });
  }
}

export class PrismaSecurityRepository implements ISecurityRepository {
  async listByPackageId(packageId: string): Promise<SecurityFindingEntity[]> {
    const db = getPrisma();
    const findings = await db.securityFinding.findMany({
      where: { packageId },
      orderBy: { publishedAt: 'desc' },
    });
    return findings.map((s) => ({
      id: s.id,
      packageId: s.packageId,
      cveId: s.cveId,
      summary: s.summary,
      severity: s.severity as any,
      affectedVersions: s.affectedVersions,
      fixedVersion: s.fixedVersion || undefined,
      advisoryUrl: s.advisoryUrl || undefined,
      publishedAt: s.publishedAt.toISOString(),
    }));
  }

  async listAll(): Promise<SecurityFindingEntity[]> {
    const db = getPrisma();
    const findings = await db.securityFinding.findMany({
      orderBy: { publishedAt: 'desc' },
    });
    return findings.map((s) => ({
      id: s.id,
      packageId: s.packageId,
      cveId: s.cveId,
      summary: s.summary,
      severity: s.severity as any,
      affectedVersions: s.affectedVersions,
      fixedVersion: s.fixedVersion || undefined,
      advisoryUrl: s.advisoryUrl || undefined,
      publishedAt: s.publishedAt.toISOString(),
    }));
  }
}
