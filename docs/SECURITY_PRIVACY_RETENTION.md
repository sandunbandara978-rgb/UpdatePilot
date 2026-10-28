# UpdatePilot — Security, Privacy & Data Retention Policy

**Document Version:** 1.0.0-final  
**Baseline Date:** October 28, 2026  
**Scope:** Core Web Application, Central API, Windows Desktop Agent, and PowerShell Client  

---

## 1. Threat Model & Security Boundaries

UpdatePilot is designed around a **Zero-Trust Client-Agent Model** with distinct security perimeters:

```
+-------------------------------------------------------------------------+
| UNTRUSTED EXTERNAL NETWORK / USER BROWSER                               |
| - Authenticated via HTTP-only Cookies & HMAC-SHA256 Session Tokens       |
| - Protected by CSRF SameSite=Lax and Origin Header Validation           |
| - Protected by Sliding-Window Rate Limiter (Brute-Force Protection)     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| TRUSTED CENTRAL APPLICATION & BACKEND API (/api/v1/*)                   |
| - Enforces Server-Side Session Auth (`getAuthenticatedUser`)            |
| - Enforces Strict Device & Job Ownership (Cross-Device Isolation)       |
| - Validates all inputs using Strict Zod Schemas & Regexes               |
| - Stores Agent Token Hashes using PBKDF2-SHA512 (100,000 iterations)    |
+------------------------------------+------------------------------------+
                                     ^
                                     | Outbound HTTPS Only (Bearer Token)
+------------------------------------+------------------------------------+
| LOCAL WORKSTATION SECURITY BOUNDARY (Windows 10/11 Host)                |
| - Dedicated Device Credentials Vault (Restricted NTFS / DPAPI)          |
| - Strictly Allowlisted Fixed Executables (`winget.exe` only)            |
| - No Shell Interpolation (Arguments passed as fixed string arrays)      |
| - Explicit `--version <targetVersion>` and `--disable-interactivity`    |
| - Independent Post-Install Verification via Exact Version Comparator    |
+-------------------------------------------------------------------------+
```

### Threat Mitigation Matrix

| Threat Category | Potential Impact | UpdatePilot Architectural Countermeasure |
| :--- | :--- | :--- |
| **Command Injection** | Arbitrary code execution via shell metacharacters in package IDs or version strings. | Arguments are NEVER passed to a shell (`cmd.exe` or `powershell -c`). Executions call `execFileAsync('winget.exe', args)` directly. Package IDs are validated against `SAFE_PACKAGE_ID_REGEX` (`/^[a-zA-Z0-9_\-\.\+]+$/`). |
| **Cross-Device Hijacking** | Device A polls, claims, or reports jobs intended for Device B. | Every job claim and report requires cryptographic agent token verification and matches `job.deviceId === agent.deviceId`. Unauthorized requests are rejected with `403 Forbidden`. |
| **Credential Spoofing** | Stolen agent tokens or forged pairing codes. | Pairing codes expire in 10 minutes and are single-use. Tokens are 256-bit cryptographically secure hex strings. The backend stores only `PBKDF2-SHA512` token hashes with unique cryptographic salts. |
| **Brute-Force Attacks** | Repeated guessing of passwords or 6-digit pairing codes. | In-memory sliding-window `RateLimiter` enforces: Login: max 5 attempts per 5 minutes per IP/username; Pairing: max 10 attempts per minute per IP. Exceeded limits return `429 Too Many Requests`. |
| **False Update Proof** | Installer exits with code 0 without actually updating files, or downgrades software. | Post-install `VerificationEngine` queries `winget list --id <pkg> --exact`, reads the actual installed version from the OS, and executes strict version comparison. Target version is NEVER substituted. |
| **Volatile Data Overwrite** | Malicious or buggy scan upload overwriting another tenant's inventory. | Scans can only be submitted for the authenticated agent's own device ID. Applications are scoped strictly by `(deviceId, packageId)`. |

---

## 2. Authentication & Authorization Architecture

### 2.1 User Session Authentication
- **Mechanism:** HMAC-SHA256 signed session tokens stored in secure cookies (`auth_token`).
- **Signature Verification:** Handled by `SecurityAuth.verifySessionToken(token, secret)`. Tokens carry `{ userId, email, role, exp }`.
- **Role Enforcement:** All state-changing routes enforce role checking (`ADMIN` / `OPERATOR`) and verify device ownership before job dispatch.

### 2.2 Agent Device Authentication
- **Pairing Code Generation:** Requires active user session. Generates a random 6-character code (e.g. `UP-892401`) stored with an expiration timestamp (`Date.now() + 10 * 60 * 1000`).
- **Token Exchange:** The agent submits the pairing code. Upon validation, the server generates a 32-byte cryptographically secure random token (`crypto.randomBytes(32).toString('hex')`), hashes it with a random salt using `PBKDF2-SHA512`, stores the hash and salt, and invalidates the pairing code.
- **Continuous Verification:** Every heartbeat, poll, claim, and report call passes `Authorization: Bearer <token>`. The backend verifies the token hash against active credentials and checks `cred.isRevoked === false`.

---

## 3. Execution Safety & Principle of Least Privilege

1. **Fixed Binary Invocations:** The agent invokes `winget.exe` using its canonical path or resolved executable path.
2. **Explicit Target Version Binding:**
   `winget upgrade --id <PackageId> --version <TargetVersion> --disable-interactivity --accept-source-agreements --accept-package-agreements`
   This prevents WinGet from upgrading to unintended intermediate or bleeding-edge versions.
3. **No Interactive Prompts:** The `--disable-interactivity` flag guarantees that installers cannot hang indefinitely waiting for background UI prompts.
4. **Independent Post-Upgrade Rescan:**
   The agent executes `winget list --id <PackageId> --exact` and inspects the output. If the version does not match the target version, the job fails.

---

## 4. Privacy & Data Minimization

UpdatePilot collects only telemetry necessary for software inventory management and vulnerability matching:

### Data Collected:
- **Device Metadata:** Device Hostname, Operating System Name/Build (e.g., `Windows 10 10.0.19045`), Agent Version.
- **Application Inventory:** Software Display Name, Package Identifier (e.g. `Mozilla.Firefox`), Installed Version, Available Version, Source repository (`winget` / `msstore`).
- **Update Telemetry:** Execution start/finish timestamps, installer exit code, verified post-install version, standard error output on failure.

### Data NOT Collected:
- No personal documents, file names, or user directory contents.
- No browser history, cookies, or user profile data.
- No network traffic, keystrokes, or active process monitoring.
- No Windows account passwords or credentials.

---

## 5. Data Retention, Audit & Purge Policy

1. **Active Inventory:** Persists until replaced by a subsequent scan of the same device, or until the device is explicitly removed by an administrator.
2. **Audit Events (`AuditEvent`):** Retained in PostgreSQL database for **365 days** (configurable via enterprise retention policy).
3. **Update Jobs (`UpdateJob`):** Retained for **90 days** for compliance and rollback reference.
4. **Stale Pairing Codes:** Automatically expired after 10 minutes and removed from memory/database during hourly maintenance sweeps.
5. **Demo Fixtures:** Isolated under fixture device ID `dev_win11_workstation_fixture`. An administrator can purge all fixture data at any time via **Settings -> Purge Demo Fixtures** (`POST /api/v1/system/clear-demo`).
6. **Device Deletion:** When a device is deleted, a cascading database delete purges all associated applications, pending jobs, and credential records.

---

## 6. Backup & Disaster Recovery

- **PostgreSQL Database:** Daily automated logical backups (`pg_dump`) with point-in-time recovery (PITR) supported on managed database providers (Neon, Supabase).
- **Disk-Backed Memory Store:** Persistent state stored in JSON format (`updatepilot-storage.json`). Can be backed up simply by snapshotting the file.
- **Restoration Procedure:**
  1. Restore the PostgreSQL database from the latest SQL backup dump.
  2. Start the UpdatePilot central web application.
  3. Workstation agents automatically reconnect via outbound HTTPS on their next heartbeat cycle (30 seconds) without requiring re-pairing.

