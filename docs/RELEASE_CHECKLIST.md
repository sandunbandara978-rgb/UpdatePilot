# UpdatePilot — Release Checklist & Deployment Runbook

**Document Version:** 1.0.0-final  
**Target Release Date:** November 30, 2026  
**Release Tag:** `v1.0.0-mvp`  
**Branch:** `feature/agent-installer-release` (ready to merge to `release/mvp-handover` / `main`)  

---

## 1. Pre-Flight Verification Checklist

Before deploying or handing over the UpdatePilot release, verify that each of the following technical gates passes:

| Gate | Verification Command | Expected Outcome | Verified |
| :--- | :--- | :--- | :---: |
| **Workspace Dependencies** | `npm ci` | All root and workspace packages installed cleanly. | [x] |
| **Prisma Client Generation** | `npx prisma generate` | `@prisma/client` generated to `node_modules`. | [x] |
| **Shared Package Build** | `npm --workspace=packages/shared run build` | TypeScript compiles to `packages/shared/dist`. | [x] |
| **Windows Agent Build** | `npm --workspace=agent run build` | TypeScript compiles to `agent/dist`. | [x] |
| **Web Production Build** | `cross-env NODE_OPTIONS=--max-old-space-size=4096 npm --workspace=apps/web run build` | Next.js compiles all static and dynamic routes (Exit Code 0). | [x] |
| **Automated Test Suite** | `npx vitest run` | All 8 test suites pass (42/42 tests passing, 0 failures). | [x] |
| **TypeScript Strict Checking** | `npm run typecheck` | 0 type errors across all workspaces. | [x] |
| **Release Packaging Pipeline** | `npm run release:all` | Staging, Inno Setup installer build, and release verification pass. | [x] |
| **Installer Artifact Verification** | `npm run release:verify` | Installer exists (>25 MB), SHA-256 matches manifest, staging pure. | [x] |
| **WinGet Host Availability** | `winget --version` | WinGet version 1.6+ detected on Windows host. | [x] |

---

## 2. Environment Variables Specification

The central platform requires the following environment variables. In local development or standalone mode, a fallback persistent disk storage is utilized if `DATABASE_URL` is omitted. For production multi-tenant deployment, configure:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Prisma pooled or direct). | `postgresql://updatepilot:pass@db.example.com:5432/updatepilot?schema=public` |
| `SESSION_SECRET` | 256-bit secret key used to HMAC-sign session cookies. Mandatory in production mode. | `c687e8e5f29910a3e828453472098d631ff928bb7c8a49df67b9319e075c328e` |
| `NODE_ENV` | Application environment mode. | `production` |
| `PORT` | Local HTTP listening port. | `3000` |
| `NEXT_PUBLIC_API_URL` | Base public URL for client requests. | `http://localhost:3000` or `https://updatepilot.yourcompany.com` |

---

## 3. Database Deployment & Migration Guide

### 3.1 Applying Migrations to PostgreSQL
UpdatePilot uses Prisma for database migrations. To apply pending migrations against a new or existing PostgreSQL database:

```bash
# Apply migrations safely without dropping data
npx prisma migrate deploy

# Verify schema synchronization
npx prisma db pull --print
```

### 3.2 Seeding Reference Data
To seed initial administrator accounts, reference metadata, and verified vulnerability catalogs:

```bash
# Run the automated seed script
npm run prisma:seed
```

Default seeded credentials (must be changed in production):
- **Admin Email:** `admin@updatepilot.io`
- **Initial Password:** `AdminSecure2026!`

---

## 4. Windows Agent Packaging & Client Distribution

UpdatePilot provides three distribution channels for Windows machines:

### Option A: Windows Desktop Agent Installer (Official Client Release)
**Recommended for all end-users and non-developer client workstations.**

1. **Build the installer package:**
   ```bash
   npm run release:all
   ```
2. **Output Artifact:**
   - File: `dist/installer/UpdatePilot-Agent-Setup-1.0.0-x64.exe` (26.04 MB)
   - SHA-256: `3e18dbe4fe4762debce7c2f721d0a3fe57e9613ee6c187ab2951254c5fd439c0`
   - Manifest: `dist/installer/release-manifest.json`
   - Architecture: Windows x64
   - Scope: Per-user (`{localappdata}\Programs\UpdatePilot-Agent`) — **no administrator UAC elevation required**.
3. **What is bundled inside the installer:**
   - Private tested Windows Node.js x64 runtime (`node.exe` v26.4.0) — target computers do not need Node.js installed.
   - Compiled `@updatepilot/agent` and production dependencies (`commander`, `zod`). Zero symlinks.
   - Graphical Setup & Pairing Wizard (`Setup-Wizard.ps1`).
   - Start Menu group `UpdatePilot Agent` with shortcuts:
     - *UpdatePilot Setup Wizard*
     - *UpdatePilot Agent Service*
     - *Run Software Scan Now*
     - *Agent Connection Status*
     - *Uninstall UpdatePilot Agent*
   - Optional Desktop Shortcut.
   - Automatic background service worker starting silently at user logon (`{userstartup}\UpdatePilot Agent.lnk` -> `Start-Agent-Silent.vbs`).
   - Windows DPAPI credential vault encryption (`%LOCALAPPDATA%\UpdatePilot\credentials.dat`).
4. **Client Installation Steps:**
   - Run `UpdatePilot-Agent-Setup-1.0.0-x64.exe`.
   - Complete the setup wizard. On the final step, the Graphical Setup Wizard launches.
   - Enter your UpdatePilot Server URL (e.g. `https://updatepilot.yourcompany.com`) and 6-character Pairing Code (e.g. `UP-892401`).
   - Click **Pair This Computer**. Credentials are encrypted using Windows DPAPI.
5. **Silent / Enterprise Mass-Deployment:**
   ```cmd
   UpdatePilot-Agent-Setup-1.0.0-x64.exe /VERYSILENT /NORESTART /TASKS="startup"
   ```
6. **Uninstallation:**
   Run *Uninstall UpdatePilot Agent* from Windows Settings or Start Menu. The uninstaller terminates background worker processes and prompts whether to securely delete stored DPAPI credentials.

### Option B: TypeScript Desktop Agent (For Developers & Source Checkouts)
1. Build the agent workspace:
   ```bash
   npm --workspace=agent run build
   ```
2. Run interactive setup or CLI commands:
   ```powershell
   node agent/dist/index.js setup
   # Or directly:
   node agent/dist/index.js pair --code <PAIRING_CODE> --server https://updatepilot.yourcompany.com
   node agent/dist/index.js service
   ```

### Option C: Standalone PowerShell Client (Zero-Prerequisite Native Windows)
1. Locate `agent/UpdatePilot-Client.ps1`.
2. Requires only native Windows PowerShell 5.1+ and native `winget.exe`.
3. On the target workstation:
   ```powershell
   .\agent\UpdatePilot-Client.ps1 -ServerUrl https://updatepilot.yourcompany.com -PairingCode <PAIRING_CODE>
   ```

---

## 5. Backup & Recovery Runbook

### 5.1 Database Backup
```bash
# Create timestamped logical backup
pg_dump -U updatepilot -h db.example.com -d updatepilot -F c -b -v -f "updatepilot_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 5.2 Database Restoration
```bash
# Restore from backup dump
pg_restore -U updatepilot -h db.example.com -d updatepilot -v "updatepilot_backup_20261028_120000.dump"
```

### 5.3 Local Disk Storage Backup (MemoryStore Mode)
When running without PostgreSQL, all state is safely persisted to `data/updatepilot-storage.json`. Simply copy or archive this file:
```powershell
Copy-Item "data\updatepilot-storage.json" -Destination "backups\updatepilot-storage-backup.json"
```

---

## 6. Handover Sign-off Form

- **Delivered By:** Senior Systems Engineer (UpdatePilot Core Engineering Team)
- **Delivered To:** Client Project Evaluation & Acceptance Team
- **Git Branch:** `feature/agent-installer-release`
- **Delivery Target Status:** Complete & Verified ahead of November 30, 2026 deadline.
- **Accepted By (Client Representative):** ___________________________
- **Date of Acceptance:** ___________________________
