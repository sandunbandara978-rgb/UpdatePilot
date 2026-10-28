# UpdatePilot — Client Acceptance & Demonstration Script

**Document Version:** 1.0.0-final  
**Target Delivery Date:** November 30, 2026  
**Audience:** Client Technical Evaluators, Project Stakeholders, and Acceptance Team  
**Prerequisites:** UpdatePilot Web Server running (`http://localhost:3000`), paired Windows 10/11 workstation with WinGet installed.  

---

## 1. Overview of the Demonstration

This demonstration script provides an end-to-end, step-by-step walkthrough of the UpdatePilot platform for formal client acceptance. It proves all **MUST** functional requirements (FR-01 through FR-14), security safeguards, human-in-the-loop authorization, and verified update execution.

---

## 2. Step-by-Step Demonstration Walkthrough

### Step 1: User Login & Session Security
- **Goal:** Verify server-side user authentication, HMAC-SHA256 session tokens, and brute-force rate limiting.
- **Action:**
  1. Open a browser and navigate to `http://localhost:3000/login`.
  2. Enter credentials:
     - **Email:** `admin@updatepilot.io`
     - **Password:** `AdminSecure2026!`
  3. Click **Sign In**.
- **Expected Outcome:**
  - Login succeeds, and an `auth_token` cookie is set.
  - The browser redirects to the central **Executive Dashboard** (`/`).
  - Demonstrate rate limiting: attempt 6 rapid failed logins from an incognito window; the system returns HTTP 429: *"Too many failed login attempts. Please wait 5 minutes."*

### Step 2: Connected Devices & Agent Pairing
- **Goal:** Demonstrate cryptographic agent pairing and device health monitoring (FR-01).
- **Action:**
  1. Click **Connect Agent** in the top navigation bar.
  2. Click **Generate Pairing Code**. Observe the 6-character code (e.g. `UP-892401`) with a 10-minute timer.
  3. Show the command line on the Windows workstation:
     ```powershell
     node agent/dist/index.js status
     ```
  4. Note the output displaying:
     - Device ID: `dev_1793085114917_gzp7c`
     - Host: `DESKTOP-TSC1SCD [Windows_NT 10.0.19045]`
     - WinGet Status: `Available (v1.10.340)`
     - Pairing Status: `Paired & Authenticated`
- **Expected Outcome:**
  - The dashboard displays the device status as **ONLINE** with a live heartbeat timestamp.

### Step 3: Real Host Discovery & Live Application Inventory
- **Goal:** Demonstrate real host software discovery via WinGet and database ingestion (FR-02, FR-03).
- **Action:**
  1. On the dashboard, click **Scan Now** (or execute `node agent/dist/index.js scan --submit` on the host).
  2. Observe the discovery progress. The agent executes `winget list --accept-source-agreements` and parses installed applications.
  3. Navigate to **Application Inventory** (`/applications`).
- **Expected Outcome:**
  - The table populates with **51 real applications** discovered on the host (e.g., `Google.Antigravity`, `Microsoft.AppInstaller`, `CrystalDiskInfo`, `Git`).
  - Each item displays its verified package ID, publisher, current installed version, and available update version.
  - Software without public repository matches is cleanly marked with grey `UNSUPPORTED`/`UNMATCHED` badges rather than fake data.

### Step 4: Multi-Filter Search, Sorting & Pagination
- **Goal:** Verify that search, filters, sorting, and pagination work seamlessly together without truncating data (FR-06).
- **Action:**
  1. In the search box, type `Git`. The table instantly filters down to matching packages.
  2. Select the **Status Filter** dropdown and choose `UPDATE_AVAILABLE`.
  3. Click the **Sort By** column header to toggle between alphabetical and version order.
  4. Clear the search and observe pagination controls (10 items per page with total page count).
- **Expected Outcome:**
  - Fast, responsive client-server filtering with 0 record omissions.

### Step 5: Update Preview & Metadata Intelligence
- **Goal:** Verify trusted package metadata, checksum display, and CVE security findings (FR-05, FR-10).
- **Action:**
  1. Navigate to the **Update Center** (`/updates`).
  2. Locate an application with an update available (e.g., `Notepad++.Notepad++` or `VideoLAN.VLC`).
  3. Click **Review & Update**.
- **Expected Outcome:**
  - The **Update Preview Modal** opens, displaying:
    - Current installed version vs. Target version.
    - Official Publisher Release Notes link.
    - Installer Type (e.g., `wix` / `nullsoft`).
    - Cryptographic SHA-256 hash from the official manifest.
    - Honest security advisory disclosure (CVE findings with source and timestamp).

### Step 6: Human-in-the-Loop Confirmation & Safe Execution
- **Goal:** Prove that no update can execute without explicit user authorization, and observe the live 5-stage progress indicator (FR-07).
- **Action:**
  1. Note that the **Execute Confirmed Update** button is disabled until the confirmation checkbox is ticked.
  2. Check the box: *"I explicitly authorize this update to version [TargetVersion]"*.
  3. Click **Execute Confirmed Update**.
- **Expected Outcome:**
  - The modal initiates live backend job tracking:
    - **Stage 1 (QUEUED):** Job created in database.
    - **Stage 2 (CLAIMED):** Agent claims the job using its device token.
    - **Stage 3 (RUNNING):** WinGet executes with strictly bound `--version` and `--disable-interactivity`.
    - **Stage 4 (VERIFYING):** Post-install verification rescan runs.
    - **Stage 5 (COMPLETED):** Success confirmed with verified version proof.

### Step 7: Independent Post-Install Version Verification
- **Goal:** Prove that UpdatePilot never substitutes target versions or trusts exit code 0 alone (FR-08).
- **Action:**
  1. Review the test case in `verificationEngine.test.ts` where partial prefix strings (`1.0` vs `1.0.1`) are rejected.
  2. Show that on the live host, the agent rescanned `winget list --id <PackageId> --exact` and proved version equality before submitting `COMPLETED`.
- **Expected Outcome:**
  - The job status in the database includes `verifiedVersion` matching the target version.

### Step 8: Immutable Audit Trail & CSV Export
- **Goal:** Verify diagnostic history persistence and compliance report export (FR-09, FR-11).
- **Action:**
  1. Navigate to **History & Logs** (`/history`).
  2. Inspect the latest completed update event: notice the start time, completion time, installer exit code (`0`), initiator, and verified version.
  3. Click **Export Update History (CSV)**.
  4. Open the downloaded CSV file in Excel or a text editor.
- **Expected Outcome:**
  - The CSV conforms to RFC-4180 standards with proper column headers, quotes, and timestamps.

### Step 9: Settings, Theme Persistence & Demo Fixture Purge
- **Goal:** Verify that preferences persist and demo data can be isolated (FR-12, FR-13).
- **Action:**
  1. Navigate to **Settings** (`/settings`).
  2. Toggle the theme from **Dark** to **Light**. Notice the immediate theme transition.
  3. Refresh the page (F5) or close and reopen the tab. Notice the light theme persists without flashing (anti-FOUC).
  4. Switch back to **Dark Mode**.
  5. Click **Purge Demo Fixtures**.
  6. Return to **Application Inventory** (`/applications`).
- **Expected Outcome:**
  - Synthetic demo fixtures are purged from the inventory, leaving only genuine host applications.

---

## 3. Client Acceptance Checklist

| Step # | Feature Demonstrated | Acceptance Criteria | Verified |
| :---: | :--- | :--- | :---: |
| 1 | Server-Side Auth & Rate Limiting | Unauthorized users blocked; brute-force protected. | [x] |
| 2 | Agent Pairing & Device Health | 6-digit code pairs device; token hashed with PBKDF2. | [x] |
| 3 | WinGet Software Discovery | Discovers 50+ real applications on host; stores in DB. | [x] |
| 4 | Search, Filter & Pagination | Fast combined search/filter without record loss. | [x] |
| 5 | Update Preview & Intelligence | Shows release notes, license, SHA-256, and CVEs. | [x] |
| 6 | Human-in-the-Loop Authorization | Explicit checkbox required; live 5-stage progress. | [x] |
| 7 | Zero-Trust Verification | Installer exit code 0 verified with post-install scan. | [x] |
| 8 | History Audit Trail & CSV Export | Diagnostic log recorded; full CSV export downloaded. | [x] |
| 9 | Settings, Theme & Demo Purge | Theme persists in localStorage; demo data purgeable. | [x] |

