import { NextRequest } from 'next/server';
import { GET as installGet } from '../install/route';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  return installGet();
}
