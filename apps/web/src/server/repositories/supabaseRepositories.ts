import { getSupabaseAdmin } from '@/lib/supabase/admin';
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

// 1. Supabase Profiles / Users
export class SupabaseUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserEntity['role'],
      passwordHash: '',
      createdAt: data.created_at,
    };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserEntity['role'],
      passwordHash: '',
      createdAt: data.created_at,
    };
  }

  async create(userData: { id?: string; email: string; name: string; passwordHash: string; role?: UserEntity['role'] }): Promise<UserEntity> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        ...(userData.id ? { id: userData.id } : {}),
        email: userData.email.toLowerCase().trim(),
        name: userData.name.trim(),
        role: userData.role || 'USER',
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create Supabase user profile: ${error?.message}`);
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserEntity['role'],
      passwordHash: '',
      createdAt: data.created_at,
    };
  }

  async count(): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    return error ? 0 : (count || 0);
  }
}

// 2. Supabase User Settings
export class SupabaseSettingsRepository implements ISettingsRepository {
  async getByUserId(userId: string): Promise<UserSettingsEntity> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      return {
        userId: data.user_id,
        theme: data.theme as UserSettingsEntity['theme'],
        scanIntervalHours: data.scan_interval_hours,
        autoCheckUpdates: data.auto_check_updates,
        emailAlerts: data.email_alerts,
        updatedAt: data.updated_at,
      };
    }

    return this.upsert(userId, {
      theme: 'system',
      scanIntervalHours: 12,
      autoCheckUpdates: true,
      emailAlerts: false,
    });
  }

  async upsert(
    userId: string,
    data: Partial<Omit<UserSettingsEntity, 'userId' | 'updatedAt'>>
  ): Promise<UserSettingsEntity> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (data.theme !== undefined) payload.theme = data.theme;
    if (data.scanIntervalHours !== undefined) payload.scan_interval_hours = data.scanIntervalHours;
    if (data.autoCheckUpdates !== undefined) payload.auto_check_updates = data.autoCheckUpdates;
    if (data.emailAlerts !== undefined) payload.email_alerts = data.emailAlerts;

    const { data: result, error } = await supabase
      .from('settings')
      .upsert(payload)
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to upsert settings: ${error?.message}`);
    }

    return {
      userId: result.user_id,
      theme: result.theme as UserSettingsEntity['theme'],
      scanIntervalHours: result.scan_interval_hours,
      autoCheckUpdates: result.auto_check_updates,
      emailAlerts: result.email_alerts,
      updatedAt: result.updated_at,
    };
  }
}

// 3. Supabase Devices
export class SupabaseDeviceRepository implements IDeviceRepository {
  async findById(id: string): Promise<DeviceEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      deviceName: data.device_name,
      osVersion: data.os_version,
      osBuild: data.os_build || undefined,
      agentVersion: data.agent_version,
      status: data.status as DeviceEntity['status'],
      lastSeenAt: data.last_seen_at,
      createdAt: data.created_at,
    };
  }

  async findByPairingCode(code: string): Promise<DeviceEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('pairing_code', code)
      .gt('pairing_code_expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      deviceName: data.device_name,
      osVersion: data.os_version,
      osBuild: data.os_build || undefined,
      agentVersion: data.agent_version,
      status: data.status as DeviceEntity['status'],
      lastSeenAt: data.last_seen_at,
      createdAt: data.created_at,
    };
  }

  async listByUserId(userId: string): Promise<DeviceEntity[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      userId: d.user_id,
      deviceName: d.device_name,
      osVersion: d.os_version,
      osBuild: d.os_build || undefined,
      agentVersion: d.agent_version,
      status: d.status as DeviceEntity['status'],
      lastSeenAt: d.last_seen_at,
      createdAt: d.created_at,
    }));
  }

  async create(data: Omit<DeviceEntity, 'id' | 'createdAt'>): Promise<DeviceEntity> {
    const supabase = getSupabaseAdmin();
    const { data: d, error } = await supabase
      .from('devices')
      .insert({
        user_id: data.userId,
        device_name: data.deviceName,
        os_version: data.osVersion,
        os_build: data.osBuild || null,
        agent_version: data.agentVersion,
        status: data.status || 'ONLINE',
      })
      .select()
      .single();

    if (error || !d) {
      throw new Error(`Failed to create device: ${error?.message}`);
    }

    return {
      id: d.id,
      userId: d.user_id,
      deviceName: d.device_name,
      osVersion: d.os_version,
      osBuild: d.os_build || undefined,
      agentVersion: d.agent_version,
      status: d.status as DeviceEntity['status'],
      lastSeenAt: d.last_seen_at,
      createdAt: d.created_at,
    };
  }

  async update(id: string, data: Partial<DeviceEntity>): Promise<DeviceEntity> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.deviceName) payload.device_name = data.deviceName;
    if (data.osVersion) payload.os_version = data.osVersion;
    if (data.osBuild !== undefined) payload.os_build = data.osBuild;
    if (data.agentVersion) payload.agent_version = data.agentVersion;
    if (data.status) payload.status = data.status;
    if (data.lastSeenAt) payload.last_seen_at = data.lastSeenAt;

    const { data: d, error } = await supabase
      .from('devices')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !d) {
      throw new Error(`Failed to update device ${id}: ${error?.message}`);
    }

    return {
      id: d.id,
      userId: d.user_id,
      deviceName: d.device_name,
      osVersion: d.os_version,
      osBuild: d.os_build || undefined,
      agentVersion: d.agent_version,
      status: d.status as DeviceEntity['status'],
      lastSeenAt: d.last_seen_at,
      createdAt: d.created_at,
    };
  }

  async setPairingCode(id: string, code: string, expiresAt: Date): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('devices')
      .update({
        pairing_code: code || null,
        pairing_code_expires_at: expiresAt.toISOString(),
      })
      .eq('id', id);
  }

  async createCredential(deviceId: string, tokenHash: string, salt: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('agent_credentials').insert({
      device_id: deviceId,
      token_hash: tokenHash,
      salt: salt,
      is_revoked: false,
    });
  }

  async findCredentialByToken(token: string): Promise<{ deviceId: string; isRevoked: boolean } | null> {
    const supabase = getSupabaseAdmin();
    const { data: creds, error } = await supabase
      .from('agent_credentials')
      .select('id, device_id, token_hash, salt, is_revoked');

    if (error || !creds) return null;

    for (const c of creds) {
      if (SecurityAuth.verifyAgentToken(token, c.token_hash, c.salt)) {
        await supabase
          .from('agent_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', c.id);
        return { deviceId: c.device_id, isRevoked: c.is_revoked };
      }
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('devices')
      .update({ status: 'REVOKED' })
      .eq('id', id);

    await supabase
      .from('agent_credentials')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('device_id', id);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('devices').delete().eq('id', id);
  }
}

// 4. Supabase Applications
export class SupabaseApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<ApplicationEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      deviceId: data.device_id,
      name: data.name,
      packageId: data.package_id || undefined,
      publisher: data.publisher || undefined,
      installedVersion: data.installed_version,
      availableVersion: data.available_version || undefined,
      source: data.source || undefined,
      status: data.status as ApplicationStatus,
      lastScannedAt: data.last_scanned_at,
    };
  }

  async findByPackageId(deviceId: string, packageId: string): Promise<ApplicationEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('device_id', deviceId)
      .ilike('package_id', packageId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      deviceId: data.device_id,
      name: data.name,
      packageId: data.package_id || undefined,
      publisher: data.publisher || undefined,
      installedVersion: data.installed_version,
      availableVersion: data.available_version || undefined,
      source: data.source || undefined,
      status: data.status as ApplicationStatus,
      lastScannedAt: data.last_scanned_at,
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
    const supabase = getSupabaseAdmin();
    let query = supabase.from('applications').select('*', { count: 'exact' });

    if (params.deviceId) {
      query = query.eq('device_id', params.deviceId);
    } else if (params.deviceIds && params.deviceIds.length > 0) {
      query = query.in('device_id', params.deviceIds);
    }

    if (params.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,package_id.ilike.%${params.search}%,publisher.ilike.%${params.search}%`
      );
    }

    const sortCol =
      params.sortBy === 'installedVersion'
        ? 'installed_version'
        : params.sortBy === 'lastScannedAt'
          ? 'last_scanned_at'
          : params.sortBy;

    query = query.order(sortCol, { ascending: params.sortOrder === 'asc' });

    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error || !data) return { items: [], total: 0 };

    const items: ApplicationEntity[] = data.map((a) => ({
      id: a.id,
      deviceId: a.device_id,
      name: a.name,
      packageId: a.package_id || undefined,
      publisher: a.publisher || undefined,
      installedVersion: a.installed_version,
      availableVersion: a.available_version || undefined,
      source: a.source || undefined,
      status: a.status as ApplicationStatus,
      lastScannedAt: a.last_scanned_at,
    }));

    return { items, total: count || 0 };
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
    const supabase = getSupabaseAdmin();
    const payload = apps.map((a) => ({
      device_id: deviceId,
      name: a.name,
      package_id: a.packageId || null,
      publisher: a.publisher || null,
      installed_version: a.installedVersion,
      available_version: a.availableVersion || null,
      source: a.source || 'winget',
      status: a.status,
      last_scanned_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('applications')
      .upsert(payload, { onConflict: 'device_id,name,installed_version' });

    if (error) {
      console.error('Supabase application upsertMany error:', error);
      return 0;
    }

    return apps.length;
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    installedVersion?: string,
    availableVersion?: string | null
  ): Promise<ApplicationEntity> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (installedVersion) payload.installed_version = installedVersion;
    if (availableVersion !== undefined) payload.available_version = availableVersion;

    const { data, error } = await supabase
      .from('applications')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update application status: ${error?.message}`);
    }

    return {
      id: data.id,
      deviceId: data.device_id,
      name: data.name,
      packageId: data.package_id || undefined,
      publisher: data.publisher || undefined,
      installedVersion: data.installed_version,
      availableVersion: data.available_version || undefined,
      source: data.source || undefined,
      status: data.status as ApplicationStatus,
      lastScannedAt: data.last_scanned_at,
    };
  }
}

// 5. Supabase Application Updates History
export class SupabaseApplicationHistoryRepository implements IApplicationHistoryRepository {
  async record(data: {
    applicationId: string;
    previousVersion: string;
    newVersion: string;
    triggerType?: string;
  }): Promise<ApplicationHistoryEntity> {
    const supabase = getSupabaseAdmin();
    const { data: h, error } = await supabase
      .from('updates')
      .insert({
        application_id: data.applicationId,
        previous_version: data.previousVersion,
        new_version: data.newVersion,
        trigger_type: data.triggerType || 'UPDATE',
      })
      .select()
      .single();

    if (error || !h) {
      throw new Error(`Failed to record update history: ${error?.message}`);
    }

    return {
      id: h.id,
      applicationId: h.application_id,
      previousVersion: h.previous_version,
      newVersion: h.new_version,
      triggerType: h.trigger_type,
      changedAt: h.changed_at,
    };
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationHistoryEntity[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .eq('application_id', applicationId)
      .order('changed_at', { ascending: false });

    if (error || !data) return [];
    return data.map((h) => ({
      id: h.id,
      applicationId: h.application_id,
      previousVersion: h.previous_version,
      newVersion: h.new_version,
      triggerType: h.trigger_type,
      changedAt: h.changed_at,
    }));
  }
}

// 6. Supabase Jobs & Scans
export class SupabaseJobRepository implements IJobRepository {
  async findScanJobById(id: string): Promise<ScanJobEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('scans').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      deviceId: data.device_id,
      status: data.status as JobStatus,
      appsDiscovered: data.apps_discovered || 0,
      updatesDetected: data.updates_discovered || 0,
      createdAt: data.created_at,
      completedAt: data.completed_at || undefined,
      errorDetails: data.error_details || undefined,
    };
  }

  async findUpdateJobById(id: string): Promise<UpdateJobEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      deviceId: data.device_id,
      applicationId: data.application_id,
      packageId: data.package_id,
      currentVersion: data.current_version,
      targetVersion: data.target_version,
      status: data.status as JobStatus,
      executionOutput: data.execution_output || undefined,
      verificationDetails: data.verification_details || undefined,
      exitCode: data.exit_code ?? undefined,
      createdAt: data.created_at,
      startedAt: data.started_at || undefined,
      completedAt: data.completed_at || undefined,
    };
  }

  async createScanJob(deviceId: string): Promise<ScanJobEntity> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scans')
      .insert({ device_id: deviceId, status: 'QUEUED', apps_discovered: 0, updates_discovered: 0 })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create scan job: ${error?.message}`);
    return {
      id: data.id,
      deviceId: data.device_id,
      status: data.status as JobStatus,
      appsDiscovered: 0,
      updatesDetected: 0,
      createdAt: data.created_at,
    };
  }

  async createUpdateJob(data: {
    deviceId: string;
    applicationId: string;
    packageId: string;
    currentVersion: string;
    targetVersion: string;
  }): Promise<UpdateJobEntity> {
    const supabase = getSupabaseAdmin();
    const { data: j, error } = await supabase
      .from('jobs')
      .insert({
        device_id: data.deviceId,
        application_id: data.applicationId,
        package_id: data.packageId,
        current_version: data.currentVersion,
        target_version: data.targetVersion,
        status: 'QUEUED',
      })
      .select()
      .single();

    if (error || !j) throw new Error(`Failed to create update job: ${error?.message}`);
    return {
      id: j.id,
      deviceId: j.device_id,
      applicationId: j.application_id,
      packageId: j.package_id,
      currentVersion: j.current_version,
      targetVersion: j.target_version,
      status: j.status as JobStatus,
      createdAt: j.created_at,
    };
  }

  async pollPendingJob(deviceId: string): Promise<{ id: string; type: 'SCAN' | 'UPDATE'; payload: Record<string, unknown> } | null> {
    const supabase = getSupabaseAdmin();

    const { data: updateJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'QUEUED')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (updateJob) {
      return {
        id: updateJob.id,
        type: 'UPDATE',
        payload: {
          packageId: updateJob.package_id,
          targetVersion: updateJob.target_version,
        },
      };
    }

    const { data: scanJob } = await supabase
      .from('scans')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'QUEUED')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (scanJob) {
      return { id: scanJob.id, type: 'SCAN', payload: {} };
    }

    return null;
  }

  async claimJob(id: string, type: 'SCAN' | 'UPDATE', deviceId?: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const table = type === 'UPDATE' ? 'jobs' : 'scans';
    let query = supabase.from(table).update({ status: 'CLAIMED' }).eq('id', id).eq('status', 'QUEUED');

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query.select();
    return !error && Boolean(data && data.length > 0);
  }

  async updateScanJob(id: string, data: Partial<ScanJobEntity>): Promise<void> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {};
    if (data.status) payload.status = data.status;
    if (data.errorDetails !== undefined) payload.error_details = data.errorDetails;
    if (data.completedAt !== undefined) payload.completed_at = data.completedAt;
    if (data.appsDiscovered !== undefined) payload.apps_discovered = data.appsDiscovered;
    if (data.updatesDetected !== undefined) payload.updates_discovered = data.updatesDetected;

    await supabase.from('scans').update(payload).eq('id', id);
  }

  async updateUpdateJob(id: string, data: Partial<UpdateJobEntity>): Promise<void> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {};
    if (data.status) payload.status = data.status;
    if (data.startedAt !== undefined) payload.started_at = data.startedAt;
    if (data.completedAt !== undefined) payload.completed_at = data.completedAt;
    if (data.executionOutput !== undefined) payload.execution_output = data.executionOutput;
    if (data.verificationDetails !== undefined) payload.verification_details = data.verificationDetails;
    if (data.exitCode !== undefined) payload.exit_code = data.exitCode;

    await supabase.from('jobs').update(payload).eq('id', id);
  }

  async listRecentJobs(
    limit: number,
    deviceIds?: string[]
  ): Promise<Array<{ id: string; type: 'SCAN' | 'UPDATE'; title: string; status: JobStatus; timestamp: string; details?: string }>> {
    const supabase = getSupabaseAdmin();

    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (deviceIds && deviceIds.length > 0) {
      query = query.in('device_id', deviceIds);
    }

    const { data } = await query;
    if (!data) return [];

    return data.map((j) => ({
      id: j.id,
      type: 'UPDATE' as const,
      title: `Update ${j.package_id} to v${j.target_version}`,
      status: j.status as JobStatus,
      timestamp: j.created_at,
      details: j.verification_details || j.execution_output,
    }));
  }

  async listUpdateHistory(
    page: number,
    limit: number,
    deviceIds?: string[]
  ): Promise<{ items: UpdateJobEntity[]; total: number }> {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (deviceIds && deviceIds.length > 0) {
      query = query.in('device_id', deviceIds);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error || !data) return { items: [], total: 0 };

    return {
      items: data.map((j) => ({
        id: j.id,
        deviceId: j.device_id,
        applicationId: j.application_id,
        packageId: j.package_id,
        currentVersion: j.current_version,
        targetVersion: j.target_version,
        status: j.status as JobStatus,
        executionOutput: j.execution_output || undefined,
        verificationDetails: j.verification_details || undefined,
        exitCode: j.exit_code ?? undefined,
        createdAt: j.created_at,
        startedAt: j.started_at || undefined,
        completedAt: j.completed_at || undefined,
      })),
      total: count || 0,
    };
  }
}

// 7. Supabase Audit Logs
export class SupabaseAuditRepository implements IAuditRepository {
  async record(event: Omit<AuditEventEntity, 'id' | 'createdAt'>): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_logs').insert({
      user_id: event.userId || null,
      device_id: event.deviceId || null,
      event_type: event.eventType,
      action: event.action,
      target: event.target,
      metadata: event.metadata || null,
    });
  }

  async list(limit = 50, deviceIds?: string[]): Promise<AuditEventEntity[]> {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (deviceIds && deviceIds.length > 0) {
      query = query.in('device_id', deviceIds);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((a) => ({
      id: a.id,
      userId: a.user_id || undefined,
      deviceId: a.device_id || undefined,
      eventType: a.event_type as AuditEventEntity['eventType'],
      action: a.action,
      target: a.target,
      metadata: a.metadata,
      createdAt: a.timestamp,
    }));
  }
}

// 8. Supabase Release Metadata
export class SupabaseReleaseMetadataRepository implements IReleaseMetadataRepository {
  async findByPackageId(packageId: string): Promise<ReleaseMetadataEntity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('release_metadata')
      .select('*')
      .ilike('package_id', packageId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      packageId: data.package_id,
      latestVersion: data.latest_version,
      publisherUrl: data.publisher_url || undefined,
      releaseNotesUrl: data.release_notes_url || undefined,
      license: data.license || undefined,
      installerType: data.installer_type || undefined,
      sha256: data.sha256 || undefined,
      releaseDate: data.release_date || undefined,
    };
  }

  async upsert(metadata: ReleaseMetadataEntity): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('release_metadata').upsert(
      {
        package_id: metadata.packageId,
        latest_version: metadata.latestVersion,
        publisher_url: metadata.publisherUrl || null,
        release_notes_url: metadata.releaseNotesUrl || null,
        license: metadata.license || null,
        installer_type: metadata.installerType || null,
        sha256: metadata.sha256 || null,
        release_date: metadata.releaseDate || null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'package_id' }
    );
  }
}

// 9. Supabase Security Findings
export class SupabaseSecurityRepository implements ISecurityRepository {
  async listByPackageId(packageId: string): Promise<SecurityFindingEntity[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('security_findings')
      .select('*')
      .ilike('package_id', packageId);

    if (error || !data) return [];
    return data.map((f) => ({
      id: f.id,
      packageId: f.package_id,
      cveId: f.cve_id,
      summary: f.description || '',
      severity: f.severity as SecurityFindingEntity['severity'],
      affectedVersions: f.affected_versions,
      fixedVersion: f.fixed_in_version || undefined,
      publishedAt: f.published_at,
    }));
  }

  async listForPackageIds(packageIds: string[]): Promise<SecurityFindingEntity[]> {
    if (packageIds.length === 0) return [];
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('security_findings')
      .select('*')
      .in('package_id', packageIds);

    if (error || !data) return [];
    return data.map((f) => ({
      id: f.id,
      packageId: f.package_id,
      cveId: f.cve_id,
      summary: f.description || '',
      severity: f.severity as SecurityFindingEntity['severity'],
      affectedVersions: f.affected_versions,
      fixedVersion: f.fixed_in_version || undefined,
      publishedAt: f.published_at,
    }));
  }

  async listAll(): Promise<SecurityFindingEntity[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('security_findings').select('*');
    if (error || !data) return [];
    return data.map((f) => ({
      id: f.id,
      packageId: f.package_id,
      cveId: f.cve_id,
      summary: f.description || '',
      severity: f.severity as SecurityFindingEntity['severity'],
      affectedVersions: f.affected_versions,
      fixedVersion: f.fixed_in_version || undefined,
      publishedAt: f.published_at,
    }));
  }

  async replaceForPackages(packageIds: string[], findings: Array<Omit<SecurityFindingEntity, 'id'>>): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (packageIds.length > 0) {
      await supabase.from('security_findings').delete().in('package_id', packageIds);
    }
    if (findings.length > 0) {
      await supabase.from('security_findings').insert(
        findings.map((f) => ({
          package_id: f.packageId,
          cve_id: f.cveId,
          severity: f.severity,
          description: f.summary,
          affected_versions: f.affectedVersions,
          fixed_in_version: f.fixedVersion || null,
          published_at: f.publishedAt,
        }))
      );
    }
  }
}
