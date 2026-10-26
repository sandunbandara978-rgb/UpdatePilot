import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Locate UpdatePilot-Client.ps1 in agent/ directory
    const candidates = [
      path.resolve(process.cwd(), 'agent', 'UpdatePilot-Client.ps1'),
      path.resolve(process.cwd(), '..', 'agent', 'UpdatePilot-Client.ps1'),
      path.resolve(process.cwd(), '..', '..', 'agent', 'UpdatePilot-Client.ps1'),
    ];

    let scriptContent = '';
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        scriptContent = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    if (!scriptContent) {
      return new NextResponse('# Error: Client script not found on server.', { status: 404 });
    }

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="UpdatePilot-Client.ps1"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`# Error: ${msg}`, { status: 500 });
  }
}
