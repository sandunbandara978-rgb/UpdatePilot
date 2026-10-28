import { NextRequest, NextResponse } from 'next/server';
import { applicationRepo, jobRepo } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'applications';
    const rawDeviceId = searchParams.get('deviceId');
    const deviceId = rawDeviceId && rawDeviceId !== 'ALL' ? rawDeviceId : undefined;

    if (type === 'applications') {
      const { items } = await applicationRepo.list({
        deviceId,
        page: 1,
        limit: 10000,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const csvHeader = 'Name,Package ID,Publisher,Installed Version,Available Version,Source,Status,Last Scanned\r\n';
      const csvRows = items.map((a) =>
        `"${a.name.replace(/"/g, '""')}","${a.packageId || ''}","${(a.publisher || '').replace(/"/g, '""')}","${a.installedVersion}","${a.availableVersion || ''}","${a.source || ''}","${a.status}","${a.lastScannedAt}"`
      ).join('\r\n');

      const csvContent = csvHeader + csvRows;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="updatepilot-applications-report.csv"',
        },
      });
    } else {
      const { items } = await jobRepo.listUpdateHistory(1, 10000);
      const filteredItems = deviceId ? items.filter((j) => j.deviceId === deviceId) : items;

      const csvHeader = 'Job ID,Device ID,Package ID,Current Version,Target Version,Status,Exit Code,Scheduled At,Completed At\r\n';
      const csvRows = filteredItems.map((j) =>
        `"${j.id}","${j.deviceId}","${j.packageId}","${j.currentVersion}","${j.targetVersion}","${j.status}","${j.exitCode ?? ''}","${j.scheduledAt || ''}","${j.completedAt || ''}"`
      ).join('\r\n');

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
