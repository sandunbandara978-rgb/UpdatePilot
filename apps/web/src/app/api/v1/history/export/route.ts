import { NextRequest, NextResponse } from 'next/server';
import { applicationRepo, jobRepo, auditRepo, deviceRepo } from '@/server/repositories';
import { SecurityAuth } from '@/server/security/auth';
import { jsonError } from '@/server/apiResponse';

export const dynamic = 'force-dynamic';

function csvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const user = SecurityAuth.getAuthenticatedUser(req);
    if (!user) {
      return jsonError('Authentication required to export reports.', 'UNAUTHORIZED', 401);
    }

    const userDevices = await deviceRepo.listByUserId(user.id);
    const ownedDeviceIds = userDevices.map((d) => d.id);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'applications';
    const rawDeviceId = searchParams.get('deviceId');
    const deviceId = rawDeviceId && rawDeviceId !== 'ALL' ? rawDeviceId : undefined;

    if (deviceId && !ownedDeviceIds.includes(deviceId)) {
      return jsonError('Forbidden: Access denied to device export.', 'FORBIDDEN', 403);
    }

    if (type === 'applications') {
      const { items } =
        ownedDeviceIds.length > 0
          ? await applicationRepo.list({
              deviceId,
              deviceIds: deviceId ? undefined : ownedDeviceIds,
              page: 1,
              limit: 10000,
              sortBy: 'name',
              sortOrder: 'asc',
            })
          : { items: [] };

      const csvHeader = 'Name,Package ID,Publisher,Installed Version,Available Version,Source,Status,Last Scanned\r\n';
      const csvRows = items
        .map((a) =>
          [
            csvCell(a.name),
            csvCell(a.packageId),
            csvCell(a.publisher),
            csvCell(a.installedVersion),
            csvCell(a.availableVersion),
            csvCell(a.source),
            csvCell(a.status),
            csvCell(a.lastScannedAt),
          ].join(',')
        )
        .join('\r\n');

      return new NextResponse(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="updatepilot-applications-report.csv"',
        },
      });
    } else if (type === 'audit') {
      const targetDeviceIds = deviceId ? [deviceId] : ownedDeviceIds;
      const events = targetDeviceIds.length > 0 ? await auditRepo.list(10000, targetDeviceIds) : [];

      const csvHeader = 'Event ID,Timestamp,Event Type,Action,Target,Device ID,User ID\r\n';
      const csvRows = events
        .map((e) =>
          [
            csvCell(e.id),
            csvCell(e.createdAt),
            csvCell(e.eventType),
            csvCell(e.action),
            csvCell(e.target),
            csvCell(e.deviceId),
            csvCell(e.userId),
          ].join(',')
        )
        .join('\r\n');

      return new NextResponse(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="updatepilot-audit-events-report.csv"',
        },
      });
    } else {
      const targetDeviceIds = deviceId ? [deviceId] : ownedDeviceIds;
      const { items } =
        targetDeviceIds.length > 0
          ? await jobRepo.listUpdateHistory(1, 10000, targetDeviceIds)
          : { items: [] };

      const csvHeader = 'Job ID,Device ID,Package ID,Current Version,Target Version,Status,Exit Code,Scheduled At,Completed At\r\n';
      const csvRows = items
        .map((j) =>
          [
            csvCell(j.id),
            csvCell(j.deviceId),
            csvCell(j.packageId),
            csvCell(j.currentVersion),
            csvCell(j.targetVersion),
            csvCell(j.status),
            csvCell(j.exitCode),
            csvCell(j.scheduledAt),
            csvCell(j.completedAt),
          ].join(',')
        )
        .join('\r\n');

      return new NextResponse(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="updatepilot-update-history-report.csv"',
        },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Export failed: ${msg}`, { status: 500 });
  }
}
