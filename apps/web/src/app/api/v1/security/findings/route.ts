import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { securityRepo } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const findings = await securityRepo.listAll();
    return jsonSuccess({
      findings,
      disclaimer: 'Security findings are matched against verified package identifiers and trusted advisory databases. Unmatched applications are excluded.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SECURITY_FINDINGS_ERROR', 500);
  }
}
