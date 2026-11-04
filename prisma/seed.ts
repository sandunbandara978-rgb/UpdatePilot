/**
 * Seed Data for UpdatePilot
 * Seeds administrative user and host device based on local machine environment.
 */

import { PrismaClient } from '@prisma/client';
import * as os from 'os';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding UpdatePilot database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@updatepilot.local' },
    update: {},
    create: {
      email: 'admin@updatepilot.local',
      name: 'Local Administrator',
      passwordHash: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekd59gdaGQU6T6/6K', // "Password123!"
      role: 'ADMIN',
      settings: {
        create: {
          theme: 'dark',
          scanIntervalHours: 12,
          autoCheckUpdates: true,
          emailAlerts: false,
        },
      },
    },
  });

  // Create host device reflecting actual physical machine
  const hostname = os.hostname();
  const hostDeviceId = `dev_${hostname.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const hostDevice = await prisma.device.upsert({
    where: { id: hostDeviceId },
    update: { lastSeenAt: new Date(), status: 'ONLINE' },
    create: {
      id: hostDeviceId,
      userId: adminUser.id,
      deviceName: hostname,
      osVersion: `${os.type()} ${os.release()} ${os.arch()}`,
      osBuild: os.release(),
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date(),
    },
  });

  console.log(`Seeded host device: ${hostDevice.deviceName} (${hostDevice.id})`);
  console.log('Seed completed successfully. Software inventory will be populated from live host scan.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
