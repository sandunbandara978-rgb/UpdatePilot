# UpdatePilot — Security Architecture & Threat Model

## 1. Security Philosophy
UpdatePilot adheres to **Security by Design** and **Least Privilege**. Because the Windows Agent executes software modifications on the user's host operating system, strict safeguards are enforced across the entire stack:
1. **Never Arbitrary Execution:** The web interface and API never accept arbitrary terminal commands, batch scripts, or executable paths.
2. **Fixed Operation Allowlist:** The agent only executes pre-vetted, allowlisted commands strictly composed as:
   `winget.exe upgrade --id <ValidatedPackageId> --exact --accept-package-agreements --accept-source-agreements`
3. **No Unsafe Trust Overrides:** WinGet's built-in cryptographic signature and SHA-256 hash checking are never disabled (`--ignore-security-hash` is strictly forbidden).

---

## 2. Threat Modeling (STRIDE Analysis)

| Threat Category | Potential Attack Vector | UpdatePilot Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Rogue client impersonating a trusted agent or user | - Cryptographic session tokens for web users.<br/>- High-entropy agent tokens hashed using SHA-256 with per-device salts.<br/>- Pairing codes expire within 10 minutes and can be used once only. |
| **Tampering** | Malicious injection in package IDs or parameters | - Zod schema validation matching `^[A-Za-z0-9\.\-_]+$` on all package identifiers.<br/>- Arguments passed as array elements in Node `execFile` / `spawn` (not shell string concatenation) to prevent command injection. |
| **Repudiation** | Denying an update or scan was initiated | - Immutable `AuditEvent` log recording `userId`, `deviceId`, `targetPackageId`, timestamp, and client IP.<br/>- Audit logs cannot be deleted or modified via API. |
| **Information Disclosure** | Leakage of private files or system data | - Agent queries only installed software manifests via WinGet / ARP.<br/>- Never touches user directories (`C:\Users\*`), browser history, or documents.<br/>- Plaintext tokens never stored in database or logged. |
| **Denial of Service** | Agent polling flooding the backend API | - Exponential backoff on failed polls.<br/>- Global rate limiting on API endpoints (100 req/min for general API, 10 req/min for pairing).<br/>- Stale job expiration cleaner. |
| **Elevation of Privilege** | Remote unauthorized privilege escalation | - Agent runs under standard user context; requests UAC elevation via Windows API only when an installer specifically triggers elevation.<br/>- Web dashboard cannot command arbitrary root/admin tasks. |

---

## 3. Windows Host Credential Protection
The Windows Agent securely stores its persistent device ID and authentication token using protected local storage:
- **Windows DPAPI (Data Protection API):** Encrypts credentials with a key tied to the logged-in Windows user account (`CryptProtectData`).
- **Encrypted Local Vault:** Credentials are stored in `%APPDATA%\UpdatePilot\credentials.enc` with user-level read/write permissions (`icacls` restricted to current user).
- **Revocation:** If a token is revoked in the web dashboard, the backend invalidates the device immediately; the agent discards local credentials and returns to an unpaired state.
