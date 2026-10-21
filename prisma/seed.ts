/**
 * Development Seed Data for UpdatePilot
 * All records are clearly designated as DEVELOPMENT FIXTURES.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding UpdatePilot development database...');

  // Create demo user
  const demoUser = await prisma.user.upsert({
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

  // Create demo paired Windows machine
  const demoDevice = await prisma.device.upsert({
    where: { id: 'dev_win11_workstation_fixture' },
    update: { lastSeenAt: new Date() },
    create: {
      id: 'dev_win11_workstation_fixture',
      userId: demoUser.id,
      deviceName: 'DESKTOP-WIN11-PRO (Dev Fixture)',
      osVersion: 'Windows 11 Pro 23H2 (Build 22631.3007)',
      osBuild: '22631.3007',
      agentVersion: '1.0.0',
      status: 'ONLINE',
      lastSeenAt: new Date(),
    },
  });

  // Seed sample applications reflecting actual WinGet packages
  const sampleApps = [
    {
      deviceId: demoDevice.id,
      name: 'Notepad++ (64-bit x64)',
      packageId: 'Notepad++.Notepad++',
      publisher: 'Notepad++ Team',
      installedVersion: '8.8.3',
      availableVersion: '8.9.8.1',
      source: 'winget',
      status: 'UPDATE_AVAILABLE',
    },
    {
      deviceId: demoDevice.id,
      name: 'Mozilla Firefox (x64 en-US)',
      packageId: 'Mozilla.Firefox',
      publisher: 'Mozilla',
      installedVersion: '128.0',
      availableVersion: '128.0',
      source: 'winget',
      status: 'UP_TO_DATE',
    },
    {
      deviceId: demoDevice.id,
      name: 'PotPlayer 64-bit',
      packageId: 'Daum.PotPlayer',
      publisher: 'Kakao Corp.',
      installedVersion: '25.06.25.0',
      availableVersion: '26.08.19.0',
      source: 'winget',
      status: 'UPDATE_AVAILABLE',
    },
    {
      deviceId: demoDevice.id,
      name: 'Proprietary In-House Tool',
      packageId: null,
      publisher: 'Internal IT Corp',
      installedVersion: '1.0.4',
      availableVersion: null,
      source: 'local_registry',
      status: 'UNMATCHED',
    },
    {
      deviceId: demoDevice.id,
      name: 'Legacy Accounting DB Driver',
      packageId: null,
      publisher: 'LegacySoft',
      installedVersion: '2.1',
      availableVersion: null,
      source: 'arp',
      status: 'UNSUPPORTED',
    },
  ];

  for (const app of sampleApps) {
    await prisma.application.upsert({
      where: {
        deviceId_name_installedVersion: {
          deviceId: app.deviceId,
          name: app.name,
          installedVersion: app.installedVersion,
        },
      },
      update: {
        availableVersion: app.availableVersion,
        status: app.status,
      },
      create: app,
    });
  }

  // Release metadata for Notepad++
  await prisma.releaseMetadata.upsert({
    where: { packageId: 'Notepad++.Notepad++' },
    update: {},
    create: {
      packageId: 'Notepad++.Notepad++',
      latestVersion: '8.9.8.1',
      publisherUrl: 'https://notepad-plus-plus.org/',
      releaseNotesUrl: 'https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.8.1',
      license: 'GPL-3.0-or-later',
      installerType: 'wix',
      sha256: '0c4f4fe82babd7688f5c1431b1357392491563af6ffedf4e37f5de0bd71babb4',
      releaseDate: new Date('2026-09-24'),
    },
  });

  // Seed sample security finding
  await prisma.securityFinding.createMany({
    skipDuplicates: true,
    data: [
      {
        packageId: 'Notepad++.Notepad++',
        cveId: 'CVE-2023-40031',
        summary: 'Buffer overflow vulnerability in earlier versions prior to 8.5.7',
        severity: 'MEDIUM',
        affectedVersions: '<8.5.7',
        fixedVersion: '8.5.7',
        advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2023-40031',
        publishedAt: new Date('2023-09-01'),
      },
    ],
  });

  // Record initial audit event
  await prisma.auditEvent.create({
    data: {
      userId: demoUser.id,
      deviceId: demoDevice.id,
      eventType: 'SCAN_COMPLETED',
      action: 'Initial software scan completed',
      target: demoDevice.deviceName,
      metadata: { discoveredCount: 5, updatesCount: 2, isFixture: true },
    },
  });

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
