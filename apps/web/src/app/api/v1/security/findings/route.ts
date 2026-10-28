import { jsonSuccess, jsonError } from '@/server/apiResponse';
import { securityRepo } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const findings = await securityRepo.listAll();
    return jsonSuccess({
      findings,
      lastCheckedAt: new Date().toISOString(),
      source: 'OSV / National Vulnerability Database (NVD)',
      disclaimer:
        'Vulnerability intelligence is matched strictly against verified package identifiers and official public advisories. Unmatched software and local executables without upstream package mappings are excluded.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 'SECURITY_FINDINGS_ERROR', 500);
  }
}
