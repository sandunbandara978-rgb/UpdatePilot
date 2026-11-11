import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format');

    if (format === 'ps1') {
      const psCandidates = [
        path.resolve(process.cwd(), 'src', 'server', 'assets', 'UpdatePilot-Client.ps1'),
        path.resolve(process.cwd(), 'apps', 'web', 'src', 'server', 'assets', 'UpdatePilot-Client.ps1'),
        path.resolve(process.cwd(), 'agent', 'UpdatePilot-Client.ps1'),
        path.resolve(process.cwd(), '..', 'agent', 'UpdatePilot-Client.ps1'),
        path.resolve(process.cwd(), '..', '..', 'agent', 'UpdatePilot-Client.ps1'),
      ];
      for (const p of psCandidates) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          return new NextResponse(content, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': 'attachment; filename="UpdatePilot-Client.ps1"',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }
      return new NextResponse('# Error: Client script not found on server.', { status: 404 });
    }

    // Check external release asset URL first when configured for serverless cloud hosting
    if (process.env.INSTALLER_DOWNLOAD_URL) {
      return NextResponse.redirect(process.env.INSTALLER_DOWNLOAD_URL, 302);
    }

    // Serve locally compiled Windows Installer executable
    const exeCandidates = [
      path.resolve(process.cwd(), 'dist', 'installer', 'UpdatePilot-Agent-Setup-1.0.0-x64.exe'),
      path.resolve(process.cwd(), '..', 'dist', 'installer', 'UpdatePilot-Agent-Setup-1.0.0-x64.exe'),
      path.resolve(process.cwd(), '..', '..', 'dist', 'installer', 'UpdatePilot-Agent-Setup-1.0.0-x64.exe'),
    ];

    for (const p of exeCandidates) {
      if (fs.existsSync(p)) {
        const fileBuffer = fs.readFileSync(p);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.microsoft.portable-executable',
            'Content-Disposition': 'attachment; filename="UpdatePilot-Agent-Setup-1.0.0-x64.exe"',
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INSTALLER_NOT_BUNDLED_ON_CLOUD',
          message:
            'The standalone .exe installer is not bundled inside this serverless deployment. Set INSTALLER_DOWNLOAD_URL to your GitHub Release asset URL, or use the PowerShell client script at /api/v1/agent/install.',
        },
      },
      { status: 404 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Error: ${msg}`, { status: 500 });
  }
}
