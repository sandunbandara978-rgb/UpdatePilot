# UpdatePilot — End-User Operations Guide

## 1. Introduction
UpdatePilot provides Windows users with total visibility and controlled automation over their installed software updates. This guide walks through the primary user journeys.

---

## 2. Core User Journeys

### 2.1 First-Time Setup & Agent Pairing
1. Open the UpdatePilot Web Dashboard at `http://localhost:3000` (or your deployed URL).
2. Click **Connect Agent** in the top navigation bar.
3. Click **Generate Pairing Code**. A 6-digit code (e.g. `UP-892401`) will appear with a 10-minute validity window.
4. On your Windows machine, open PowerShell and navigate to the project directory:
   ```powershell
   .\agent\UpdatePilot-Agent.ps1 pair -Code UP-892401
   ```
5. The agent will cryptographically negotiate credentials and encrypt them into your Windows credential vault.
6. The dashboard will instantly update with a green **Device Successfully Paired** confirmation.

### 2.2 Scanning Installed Software
1. In the Web Dashboard, click the **Run Discovery** (or **Scan Now**) button.
2. The agent queries `winget list` to detect all installed software, publisher manifests, and available version upgrades.
3. Once completed, your dashboard metrics and application inventory will reflect real host data.

### 2.3 Reviewing & Updating Software
1. Navigate to the **Update Center** (`/updates`).
2. Each application with an available upgrade shows its current version and target version.
3. Click **Review & Update** on an application (e.g. `Notepad++`).
4. An Update Preview Modal opens showing:
   - Target version and installer type.
   - Official publisher release notes / changelog link.
   - SHA-256 cryptographic verification status.
5. Check the required box: **"I explicitly authorize this update to version X"**.
6. Click **Execute Confirmed Update**.
7. Watch the live 5-stage progress indicator:
   - Stage 1: `QUEUED` in cloud database.
   - Stage 2: `CLAIMED` by local agent.
   - Stage 3: `RUNNING` via WinGet.
   - Stage 4: `VERIFYING` installed host version.
   - Stage 5: `COMPLETED` and recorded to immutable audit trail.

### 2.4 Exporting Compliance Reports
1. Go to **Application Inventory** (`/applications`) and click **Export CSV** to download a complete spreadsheet of installed applications, publishers, versions, and statuses.
2. Go to **History & Logs** (`/history`) and click **Export Update History (CSV)** to download an audit trail of all update executions, timestamps, and exit codes.
