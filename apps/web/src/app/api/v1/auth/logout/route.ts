import { NextResponse } from 'next/server';
import { jsonSuccess } from '@/server/apiResponse';

export async function POST() {
  const res = jsonSuccess({ message: 'Successfully logged out' });
  res.cookies.delete('updatepilot_session');
  return res;
}
