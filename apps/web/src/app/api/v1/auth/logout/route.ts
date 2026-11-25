import { jsonSuccess } from '@/server/apiResponse';

export async function POST() {
  const res = jsonSuccess({ message: 'Successfully logged out' });
  res.cookies.delete('updatepilot_session');
  res.cookies.delete('sb-access-token');
  return res;
}
