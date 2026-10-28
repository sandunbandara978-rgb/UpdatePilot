# UpdatePilot — User & Troubleshooting Guide

**Document Version:** 1.0.0-final  
**Target Audience:** System Administrators, Security Engineers, and End Users  
**System Requirements:** Windows 10/11 x64, Windows Package Manager (`winget.exe` v1.6+), Node.js v18+ (for developer agent runner) or PowerShell 5.1+  

---

## 1. Executive Overview

UpdatePilot is an enterprise-grade Software Update Intelligence Platform designed to give Windows users and fleet administrators complete visibility and safe, verified control over application patching. UpdatePilot eliminates "black box" automated updates by enforcing a strict **human-in-the-loop review** model with cryptographic verification, pre-install safety checks, and post-install version proof.

---

## 2. Architecture & Operating Modes

UpdatePilot operates via two cooperating components:
1. **Central Management Dashboard (`apps/web`):**
   - Web application accessible via desktop browser (Chrome, Edge, Firefox).
   - Provides fleet metrics, inventory search, update review modal, and immutable audit logs.
   - Decoupled serverless backend running on Next.js App Router with PostgreSQL database (or persistent local JSON storage for air-gapped/offline local installations).
2. **Local Windows Agent (`agent/`):**
   - Lightweight local daemon running on each Windows workstation or server.
   - Communicates exclusively via outbound HTTPS requests to the Central Dashboard.
   - Interacts with the local Windows operating system strictly through sanitized, allowlisted `winget.exe` commands.

---

## 3. End-to-End User Journeys

### Journey 1: First-Time Setup & Agent Pairing

To link a Windows machine to UpdatePilot:
1. Log in to the UpdatePilot dashboard at `http://localhost:3000` (or your company's production domain).
2. Click **Connect Agent** in the top navigation bar.
3. Click **Generate Pairing Code**. A secure 6-digit code (e.g. `UP-892401`) will be generated. The code remains valid for **10 minutes** and is single-use.
4. On the target Windows machine, launch either the TypeScript Agent or PowerShell Client:
   - **Option A: TypeScript CLI Agent:**
     ```bash
     cd agent
     node dist/index.js pair --code UP-892401 --server http://localhost:3000
     ```
   - **Option B: Standalone PowerShell Client:**
     ```powershell
     .\agent\UpdatePilot-Client.ps1 -ServerUrl http://localhost:3000 -PairingCode UP-892401
     ```
5. The agent initiates cryptographic key negotiation:
   - The server verifies the pairing code against the user's active session.
   - The agent receives a high-entropy bearer token, which is stored securely in the local machine's encrypted vault (`%USERPROFILE%/.updatepilot/credentials.json` with restricted NTFS permissions or Windows DPAPI).
6. The dashboard displays a green confirmation badge: **Device Successfully Paired**.

### Journey 2: Running Discovery & Application Inventory

1. Once paired, the agent automatically executes an initial baseline inventory discovery.
2. At any time, you can trigger an on-demand scan:
   - From the Dashboard, click **Scan Now**.
   - Or from the Windows terminal:
     ```bash
     node agent/dist/index.js scan --submit
     ```
3. The agent executes `winget list --accept-source-agreements` via the sanitized `WinGetAdapter`.
4. It parses installed applications, identifies their unique package identities (e.g., `Git.Git`, `Notepad++.Notepad++`), detects current installed versions, and queries the Microsoft Community Repository for available updates.
5. Within 5–15 seconds, the inventory refreshes with:
   - **Total Applications Discovered** (e.g., 51 live host applications).
   - **Updates Available** (flagged in orange).
   - **Up to Date** (flagged in green).
   - **Unsupported / Unmatched** (flagged in grey for custom or legacy in-house software).

### Journey 3: Reviewing & Authorizing Updates (Human-in-the-Loop)

UpdatePilot **never** applies updates automatically without human authorization.

1. Navigate to the **Update Center** (`/updates`) in the navigation bar.
2. Select any application marked with **Update Available** and click **Review & Update**.
3. The **Update Preview Modal** opens, presenting crucial pre-install intelligence:
   - **Current Version vs. Target Version** (e.g., `8.8.3` → `8.9.8.1`).
   - **Package Identity & Source** (e.g., `winget` community manifest).
   - **Publisher Release Notes & Advisory Links**.
   - **SHA-256 Cryptographic Checksum** from official manifest.
   - **Known Security CVE Findings** associated with the current version.
4. You must check the explicit authorization box:
   > *"I explicitly authorize this update to version [targetVersion]"*
5. Click **Execute Confirmed Update**.

### Journey 4: Safe Execution & Post-Install Verification

Once authorized, the system initiates the 5-stage verified lifecycle:

```
[1. QUEUED] -> [2. CLAIMED] -> [3. RUNNING] -> [4. VERIFYING] -> [5. COMPLETED / FAILED]
```

1. **Stage 1 (QUEUED):** The update job is created in the database with strict parameter bindings: target version, device ID, application ID, and timestamp.
2. **Stage 2 (CLAIMED):** The agent on the target device polls `/api/v1/agent/jobs/poll` and atomically claims the job. (If another device attempts to claim, it is rejected with 403 Forbidden).
3. **Stage 3 (RUNNING):** The agent executes:
   ```cmd
   winget.exe upgrade --id <PackageId> --version <TargetVersion> --disable-interactivity --accept-source-agreements --accept-package-agreements
   ```
4. **Stage 4 (VERIFYING):** Even if `winget.exe` returns exit code 0, UpdatePilot **does not assume success**. The agent triggers an independent verification scan:
   ```cmd
   winget.exe list --id <PackageId> --exact
   ```
   The agent parses the actual newly installed version from Windows and compares it using `compareVersions(...) === 0`.
5. **Stage 5 (COMPLETED / FAILED):**
   - If the installed version strictly matches the target version, the job transitions to `COMPLETED` and the application is marked `UP_TO_DATE`.
   - If the installer failed, timed out, or the installed version remained unchanged, the job is marked `FAILED` with diagnostic logs.
   - If Windows reports exit code 3010 (`ERROR_SUCCESS_REBOOT_REQUIRED`), the job transitions cleanly to `RESTART_REQUIRED`.

### Journey 5: Compliance Auditing & Export

1. Navigate to **History & Logs** (`/history`) to view the immutable audit trail of every scan, pairing, and update.
2. Filter by Device, Status, or Date Range.
3. Click **Export Update History (CSV)** to download an RFC-4180 compliant CSV file containing up to 10,000 records, complete with verified versions, installer exit codes, initiator user, and timestamps.
4. Navigate to **Application Inventory** (`/applications`) and click **Export CSV** for complete inventory compliance spreadsheets.

---

## 4. Settings & Personalization

Under **Settings** (`/settings`):
- **Appearance (Theme):** Switch between **Dark Mode** and **Light Mode**. Preference is immediately applied to the DOM and persisted in `localStorage`.
- **Automatic Background Checks:** Enable or disable automatic background polling.
- **Scan Interval:** Configure how frequently background scans check for updates (e.g., Every 4 Hours, 8 Hours, 24 Hours).
- **Demo Fixture Isolation:** If demo mock data was preloaded for demonstration, click **Purge Demo Fixtures** to wipe all synthetic records, leaving 100% genuine live host data.

---

## 5. Troubleshooting & Runbook

### Issue 1: WinGet prompts for Source Agreements
- **Symptom:** Terminal or logs show:
  ```
  The msstore source requires that you view the following agreements... Do you agree? [Y] Yes [N] No
  ```
- **Cause:** First-time use of Microsoft Store sources on the machine requires agreement acceptance.
- **Resolution:** Run once in PowerShell:
  ```powershell
  winget source update --accept-source-agreements
  ```
  The UpdatePilot agent automatically passes `--accept-source-agreements` on all subcommands.

### Issue 2: Agent reports "Unauthorized" or 401 on Heartbeat
- **Symptom:** Agent console displays `Polling cycle error: HTTP Error 401: Unauthorized`.
- **Cause:** The agent's token was revoked in the web UI, or the pairing database was reset.
- **Resolution:**
  1. In the Web UI, go to **Connected Devices**, locate the device, and remove it.
  2. Click **Connect Agent** -> **Generate Pairing Code**.
  3. Re-pair the agent using `node agent/dist/index.js pair --code <NEW_CODE>`.

### Issue 3: Rate Limiting Rejection (HTTP 429)
- **Symptom:** `Too many failed login attempts. Please wait 5 minutes.` or `Too many pairing attempts. Please wait 1 minute.`
- **Cause:** Built-in sliding-window brute force protection in `rateLimiter.ts`.
- **Resolution:** Wait 1 to 5 minutes before retrying, or verify credentials.

### Issue 4: Update fails with Exit Code 1603 or 1619
- **Symptom:** Job status is `FAILED` with exit code `1603` (Generic MSI failure).
- **Cause:** The application being updated is currently open and locked by Windows (e.g., updating Firefox while Firefox is actively open).
- **Resolution:** Close the target application and re-trigger the update from the Update Center.

### Issue 5: Exit Code 3010 (Reboot Required)
- **Symptom:** Job status displays `RESTART_REQUIRED`.
- **Explanation:** Exit code 3010 is Windows Standard `ERROR_SUCCESS_REBOOT_REQUIRED`. The application files were staged successfully, but Windows locked files will be swapped upon system reboot. UpdatePilot correctly treats this as a pending reboot rather than an installation failure.

### Issue 6: Application marked as "UNMATCHED" or "UNSUPPORTED"
- **Symptom:** An application in `/applications` shows grey status `UNSUPPORTED`.
- **Explanation:** UpdatePilot enforces strict zero-trust package identity. If software was installed via a proprietary batch script, portable ZIP, or legacy installer that has no entry in the Microsoft WinGet repository, UpdatePilot flags it honestly rather than attempting arbitrary script execution.

---

## 6. Service Installation (Running Agent as Windows Service)

To run the UpdatePilot agent continuously in the background on a production workstation:

1. **Using Node.js Background Daemon:**
   ```powershell
   Start-Process -NoNewWindow -FilePath "node" -ArgumentList "agent/dist/index.js service"
   ```
2. **Using NSSM (Non-Sucking Service Manager):**
   ```powershell
   nssm install UpdatePilotAgent "C:\Program Files\nodejs\node.exe" "G:\UpdatePilot\agent\dist\index.js service"
   nssm start UpdatePilotAgent
   ```
3. **Using PowerShell Client via Task Scheduler:**
   ```powershell
   $Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File G:\UpdatePilot\agent\UpdatePilot-Client.ps1 -ServerUrl http://localhost:3000"
   $Trigger = New-ScheduledTaskTrigger -AtStartup
   Register-ScheduledTask -TaskName "UpdatePilotAgent" -Action $Action -Trigger $Trigger -User "SYSTEM"
   ```

