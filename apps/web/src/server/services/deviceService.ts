import { deviceRepo, auditRepo } from '../repositories';
import { SecurityAuth } from '../security/auth';
import { DeviceEntity } from '@updatepilot/shared';

export class DeviceService {
  async listDevices(userId: string): Promise<DeviceEntity[]> {
    return deviceRepo.listByUserId(userId);
  }

  async generatePairingCode(userId: string): Promise<{ pairingCode: string; expiresAt: string }> {
    const code = SecurityAuth.generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create an unverified device placeholder or assign to user
    const pendingDevice = await deviceRepo.create({
      userId,
      deviceName: 'Pending Pairing...',
      osVersion: 'Unknown',
      agentVersion: 'Unknown',
      status: 'OFFLINE',
      lastSeenAt: new Date().toISOString(),
    });

    await deviceRepo.setPairingCode(pendingDevice.id, code, expiresAt);

    await auditRepo.record({
      userId,
      deviceId: pendingDevice.id,
      eventType: 'AGENT_PAIRED',
      action: 'Generated agent pairing code',
      target: code,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return { pairingCode: code, expiresAt: expiresAt.toISOString() };
  }

  async pairDevice(payload: {
    pairingCode: string;
    deviceName: string;
    osVersion: string;
    osBuild?: string;
    agentVersion: string;
  }): Promise<{ deviceId: string; token: string; pollingIntervalSec: number }> {
    const device = await deviceRepo.findByPairingCode(payload.pairingCode);
    if (!device) {
      throw new Error('Invalid or expired pairing code.');
    }

    // Generate cryptographic token
    const { token, hash, salt } = SecurityAuth.generateAgentToken();

    // Store salted hash
    await deviceRepo.createCredential(device.id, hash, salt);

    // Update device profile and clear pairing code
    await deviceRepo.update(device.id, {
      deviceName: payload.deviceName,
      osVersion: payload.osVersion,
      osBuild: payload.osBuild,
      agentVersion: payload.agentVersion,
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    // Invalidate consumed pairing code
    await deviceRepo.setPairingCode(device.id, '', new Date(0));

    await auditRepo.record({
      userId: device.userId,
      deviceId: device.id,
      eventType: 'AGENT_PAIRED',
      action: 'Agent paired successfully',
      target: payload.deviceName,
      metadata: { osVersion: payload.osVersion, agentVersion: payload.agentVersion },
    });

    return {
      deviceId: device.id,
      token,
      pollingIntervalSec: 15,
    };
  }

  async verifyAgentToken(token: string): Promise<string> {
    const cred = await deviceRepo.findCredentialByToken(token);
    if (!cred || cred.isRevoked) {
      throw new Error('Unauthorized: Agent token invalid or revoked.');
    }
    return cred.deviceId;
  }

  async handleHeartbeat(
    token: string,
    payload: { osVersion?: string; agentVersion?: string; status?: 'ONLINE' | 'OFFLINE' }
  ): Promise<{ acknowledged: boolean }> {
    const deviceId = await this.verifyAgentToken(token);
    await deviceRepo.update(deviceId, {
      status: payload.status || 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      ...(payload.osVersion ? { osVersion: payload.osVersion } : {}),
      ...(payload.agentVersion ? { agentVersion: payload.agentVersion } : {}),
    });
    return { acknowledged: true };
  }

  async revokeDevice(deviceId: string, userId: string): Promise<void> {
    const device = await deviceRepo.findById(deviceId);
    if (!device) throw new Error('Device not found');
    await deviceRepo.revoke(deviceId);

    await auditRepo.record({
      userId,
      deviceId,
      eventType: 'AGENT_REVOKED',
      action: 'Revoked agent authentication token',
      target: device.deviceName,
    });
  }
}

export const deviceService = new DeviceService();
