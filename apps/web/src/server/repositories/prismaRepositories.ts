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
  UserEntity,
  UserSettingsEntity,
  ApplicationHistoryEntity,
} from '@updatepilot/shared';
import {
  IDeviceRepository,
  IApplicationRepository,
  IJobRepository,
  IAuditRepository,
  IReleaseMetadataRepository,
  ISecurityRepository,
  IUserRepository,
  ISettingsRepository,
  IApplicationHistoryRepository,
} from './types';
import { SecurityAuth } from '../security/auth';

function getPrisma() {
  if (!prisma) {
    throw new Error('Prisma client is not initialized. Ensure DATABASE_URL is set.');
  }
  return prisma;
}

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    const db = getPrisma();
    const u = await db.user.findUnique({ where: { id } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserEntity['role'],
      passwordHash: u.passwordHash,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const db = getPrisma();
    const u = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserEntity['role'],
      passwordHash: u.passwordHash,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async create(data: { id?: string; email: string; name: string; passwordHash: string; role?: UserEntity['role'] }): Promise<UserEntity> {
    const db = getPrisma();
    const u = await db.user.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        role: data.role || 'USER',
        settings: {
          create: {
            theme: 'system',
            scanIntervalHours: 12,
            autoCheckUpdates: true,
            emailAlerts: false,
          },
        },
      },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserEntity['role'],
      passwordHash: u.passwordHash,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async count(): Promise<number> {
    const db = getPrisma();
    return db.user.count();
  }
}

export class PrismaSettingsRepository implements ISettingsRepository {
  async getByUserId(userId: string): Promise<UserSettingsEntity> {
    const db = getPrisma();
    const existing = await db.userSetting.findUnique({ where: { userId } });
    if (existing) {
      return {
        userId: existing.userId,
        theme: existing.theme as UserSettingsEntity['theme'],
        scanIntervalHours: existing.scanIntervalHours,
        autoCheckUpdates: existing.autoCheckUpdates,
        emailAlerts: existing.emailAlerts,
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    const created = await db.userSetting.create({
      data: {
        userId,
        theme: 'system',
        scanIntervalHours: 12,
        autoCheckUpdates: true,
        emailAlerts: false,
      },
    });
    return {
      userId: created.userId,
      theme: created.theme as UserSettingsEntity['theme'],
      scanIntervalHours: created.scanIntervalHours,
      autoCheckUpdates: created.autoCheckUpdates,
      emailAlerts: created.emailAlerts,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async upsert(
    userId: string,
    data: Partial<Omit<UserSettingsEntity, 'userId' | 'updatedAt'>>
  ): Promise<UserSettingsEntity> {
    const db = getPrisma();
    const updated = await db.userSetting.upsert({
      where: { userId },
      update: {
        ...(data.theme !== undefined ? { theme: data.theme } : {}),
        ...(data.scanIntervalHours !== undefined ? { scanIntervalHours: data.scanIntervalHours } : {}),
        ...(data.autoCheckUpdates !== undefined ? { autoCheckUpdates: data.autoCheckUpdates } : {}),
        ...(data.emailAlerts !== undefined ? { emailAlerts: data.emailAlerts } : {}),
      },
      create: {
        userId,
        theme: data.theme || 'system',
        scanIntervalHours: data.scanIntervalHours ?? 12,
        autoCheckUpdates: data.autoCheckUpdates ?? true,
        emailAlerts: data.emailAlerts ?? false,
      },
    });

    return {
      userId: updated.userId,
      theme: updated.theme as UserSettingsEntity['theme'],
      scanIntervalHours: updated.scanIntervalHours,
      autoCheckUpdates: updated.autoCheckUpdates,
      emailAlerts: updated.emailAlerts,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export class PrismaApplicationHistoryRepository implements IApplicationHistoryRepository {
  async record(data: {
    applicationId: string;
    previousVersion: string;
    newVersion: string;
    triggerType?: string;
  }): Promise<ApplicationHistoryEntity> {
    const db = getPrisma();
    const h = await db.applicationHistory.create({
      data: {
        applicationId: data.applicationId,
        previousVersion: data.previousVersion,
        newVersion: data.newVersion,
        triggerType: data.triggerType || 'UPDATE',
      },
    });
    return {
      id: h.id,
      applicationId: h.applicationId,
      previousVersion: h.previousVersion,
      newVersion: h.newVersion,
      triggerType: h.triggerType,
      changedAt: h.changedAt.toISOString(),
    };
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationHistoryEntity[]> {
    const db = getPrisma();
    const list = await db.applicationHistory.findMany({
      where: { applicationId },
      orderBy: { changedAt: 'desc' },
    });
    return list.map((h) => ({
      id: h.id,
      applicationId: h.applicationId,
      previousVersion: h.previousVersion,
      newVersion: h.newVersion,
      triggerType: h.triggerType,
      changedAt: h.changedAt.toISOString(),
    }));
  }
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
    const list = await db.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
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
        pairingCode: code || null,
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
      where: { deviceId, packageId: { equals: packageId, mode: 'insensitive' } },
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
    deviceIds?: string[];
    search?: string;
    status?: ApplicationStatus | 'ALL';
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: ApplicationEntity[]; total: number }> {
    const db = getPrisma();
    const where: any = {};
    if (params.deviceId) {
      where.deviceId = params.deviceId;
    } else if (params.deviceIds) {
      where.deviceId = { in: params.deviceIds };
    }
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { packageId: { contains: params.search, mode: 'insensitive' } },
        { publisher: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortField = ['name', 'publisher', 'installedVersion', 'status', 'lastScannedAt'].includes(params.sortBy)
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
    const existingRows = await db.application.findMany({
      where: { deviceId },
    });

    const byPackageId = new Map<string, typeof existingRows[number]>();
    const byName = new Map<string, typeof existingRows[number]>();
    for (const row of existingRows) {
      if (row.packageId) byPackageId.set(row.packageId.toLowerCase(), row);
      byName.set(row.name.toLowerCase(), row);
    }

    let count = 0;
    const now = new Date();

    await db.$transaction(
      async (tx) => {
        for (const app of apps) {
          const match =
            (app.packageId ? byPackageId.get(app.packageId.toLowerCase()) : undefined) ||
            byName.get(app.name.toLowerCase());

          if (match) {
            if (match.installedVersion !== app.installedVersion) {
              await tx.applicationHistory.create({
                data: {
                  applicationId: match.id,
                  previousVersion: match.installedVersion,
                  newVersion: app.installedVersion,
                  triggerType: 'SCAN_DETECTED',
                },
              });
            }
            await tx.application.update({
              where: { id: match.id },
              data: {
                name: app.name,
                packageId: app.packageId,
                publisher: app.publisher,
                installedVersion: app.installedVersion,
                availableVersion: app.availableVersion,
                source: app.source || match.source || 'winget',
                status: app.status,
                lastScannedAt: now,
              },
            });
          } else {
            await tx.application.create({
              data: {
                deviceId,
                name: app.name,
                packageId: app.packageId,
                publisher: app.publisher,
                installedVersion: app.installedVersion,
                availableVersion: app.availableVersion,
                source: app.source || 'winget',
                status: app.status,
                lastScannedAt: now,
              },
            });
          }
          count++;
        }
      },
      { timeout: 30000 }
    );

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
    const updateJob = await db.updateJob.findFirst({
      where: { deviceId, status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    });

    if (updateJob) {
      return {
        id: updateJob.id,
        type: 'UPDATE',
        payload: {
          applicationId: updateJob.applicationId,
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

  async claimJob(id: string, type: 'SCAN' | 'UPDATE', deviceId?: string): Promise<boolean> {
    const db = getPrisma();
    const whereClause: any = { id, status: 'QUEUED' };
    if (deviceId) {
      whereClause.deviceId = deviceId;
    }

    if (type === 'SCAN') {
      const res = await db.scanJob.updateMany({
        where: whereClause,
        data: { status: 'CLAIMED', startedAt: new Date() },
      });
      return res.count > 0;
    } else {
      const res = await db.updateJob.updateMany({
        where: whereClause,
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
    if (data.errorDetails !== undefined) updateData.errorDetails = data.errorDetails;
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

  async listRecentJobs(
    limit: number,
    deviceIds?: string[]
  ): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>> {
    const db = getPrisma();
    const whereClause = deviceIds ? { deviceId: { in: deviceIds } } : undefined;
    const [scans, updates] = await Promise.all([
      db.scanJob.findMany({
        where: whereClause,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.updateJob.findMany({
        where: whereClause,
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
        details: u.status === 'COMPLETED' ? 'Version verified successfully' : u.verificationDetails || u.executionOutput || undefined,
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

  async listUpdateHistory(
    page: number,
    limit: number,
    deviceIds?: string[]
  ): Promise<{ items: UpdateJobEntity[]; total: number }> {
    const db = getPrisma();
    const whereClause = deviceIds ? { deviceId: { in: deviceIds } } : undefined;
    const [items, total] = await Promise.all([
      db.updateJob.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.updateJob.count({ where: whereClause }),
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

  async list(limit: number, deviceIds?: string[]): Promise<AuditEventEntity[]> {
    const db = getPrisma();
    const whereClause = deviceIds ? { deviceId: { in: deviceIds } } : undefined;
    const list = await db.auditEvent.findMany({
      where: whereClause,
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
      where: { packageId: { equals: packageId, mode: 'insensitive' } },
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

  async listForPackageIds(packageIds: string[]): Promise<SecurityFindingEntity[]> {
    if (packageIds.length === 0) return [];
    const db = getPrisma();
    const findings = await db.securityFinding.findMany({
      where: { packageId: { in: packageIds } },
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

  async replaceForPackages(
    packageIds: string[],
    findings: Array<Omit<SecurityFindingEntity, 'id'>>
  ): Promise<void> {
    if (packageIds.length === 0) return;
    const db = getPrisma();
    await db.$transaction(async (tx) => {
      await tx.securityFinding.deleteMany({
        where: { packageId: { in: packageIds } },
      });
      if (findings.length > 0) {
        await tx.securityFinding.createMany({
          data: findings.map((f) => ({
            packageId: f.packageId,
            cveId: f.cveId,
            summary: f.summary,
            severity: f.severity,
            affectedVersions: f.affectedVersions,
            fixedVersion: f.fixedVersion || null,
            advisoryUrl: f.advisoryUrl || null,
            publishedAt: new Date(f.publishedAt),
          })),
        });
      }
    });
  }
}
