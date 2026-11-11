/**
 * Seed Data for UpdatePilot
 * Seeds administrative user with PBKDF2-SHA512 password hash matching SecurityAuth
 * and initial settings.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as os from 'os';

const prisma = new PrismaClient();

function hashPasswordPBKDF2(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding UpdatePilot database...');

  const initialPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password123!';
  const passwordHash = hashPasswordPBKDF2(initialPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@updatepilot.local' },
    update: {},
    create: {
      id: 'usr_default_admin',
      email: 'admin@updatepilot.local',
      name: 'Local Administrator',
      passwordHash,
      role: 'ADMIN',
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

  // Create initial host device record representing the seeded workstation
  const hostname = os.hostname();
  const hostDeviceId = `dev_${hostname.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const hostDevice = await prisma.device.upsert({
    where: { id: hostDeviceId },
    update: { lastSeenAt: new Date(), status: 'ONLINE' },
    create: {
      id: hostDeviceId,
      userId: adminUser.id,
      deviceName: hostname,
      osVersion: `${os.type()} ${os.release()} (${os.arch()})`,
      osBuild: os.release(),
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date(),
    },
  });

  console.log(`Seeded admin user: ${adminUser.email} (${adminUser.id})`);
  console.log(`Seeded host device: ${hostDevice.deviceName} (${hostDevice.id})`);
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
