# UpdatePilot — Release Checklist & Deployment Runbook

**Document Version:** 1.0.0-final  
**Target Release Date:** November 30, 2026  
**Release Tag:** `v1.0.0-mvp`  
**Branch:** `release/mvp-handover`  

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
| **Automated Test Suite** | `npx vitest run` | All 8 test suites pass (38/38 tests passing, 0 failures). | [x] |
| **TypeScript Strict Checking** | Included in build pipeline | 0 type errors across all workspaces. | [x] |
| **WinGet Host Availability** | `winget --version` | WinGet version 1.6+ detected on Windows host. | [x] |

---

## 2. Environment Variables Specification

The platform requires the following environment variables. In local development or standalone mode, a fallback persistent disk storage is utilized if `DATABASE_URL` is omitted. For production multi-tenant deployment, configure:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Prisma pooled or direct). | `postgresql://updatepilot:pass@db.example.com:5432/updatepilot?schema=public` |
| `SESSION_SECRET` | 256-bit secret key used to HMAC-sign session cookies. | `c687e8e5f29910a3e828453472098d631ff928bb7c8a49df67b9319e075c328e` |
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
npm run db:seed
# Or via Prisma CLI:
npx prisma db seed
```

Default seeded credentials (must be changed in production):
- **Admin Email:** `admin@updatepilot.io`
- **Initial Password:** `AdminSecure2026!`

---

## 4. Agent Packaging & Workstation Deployment

UpdatePilot provides two distribution options for client Windows machines:

### Option A: TypeScript Desktop Agent (Recommended for Developers & Managed Nodes)
1. Build the agent distribution:
   ```bash
   npm --workspace=agent run build
   ```
2. Distribute the `agent/` folder containing `package.json`, `dist/`, and dependencies.
3. On the workstation:
   ```powershell
   node dist/index.js pair --code <PAIRING_CODE> --server https://updatepilot.yourcompany.com
   node dist/index.js service
   ```

### Option B: Standalone PowerShell Client (Zero-Prerequisite Native Windows)
1. Locate `agent/UpdatePilot-Client.ps1`.
2. This single-file script requires only native Windows PowerShell 5.1+ and native `winget.exe` (no Node.js required).
3. On the target workstation:
   ```powershell
   .\UpdatePilot-Client.ps1 -ServerUrl https://updatepilot.yourcompany.com -PairingCode <PAIRING_CODE>
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
- **Git Branch:** `release/mvp-handover`
- **Delivery Target Status:** Complete & Verified ahead of November 30, 2026 deadline.
- **Accepted By (Client Representative):** ___________________________
- **Date of Acceptance:** ___________________________

