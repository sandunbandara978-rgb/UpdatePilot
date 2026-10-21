# UpdatePilot — Software Update Intelligence & Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-green.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Target OS](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4.svg)](https://microsoft.com/windows)
[![Tests](https://img.shields.io/badge/Tests-17%20Passed-emerald.svg)](tests/)

> **Industrial-quality, Windows-first software update intelligence platform.**  
> UpdatePilot discovers installed applications on Windows 10/11 hosts, matches trusted package identities against official catalogs (Windows Package Manager / WinGet), presents verified release metadata and changelogs, safely executes user-confirmed updates, and strictly verifies post-update versions.

---

## 1. System Architecture

UpdatePilot decouples long-running host operations from the serverless web platform using a persistent, database-backed job orchestration pattern:

```text
                     USER
                       │
                       ▼
              WEB BROWSER (React)
                       │
                       ▼
           NEXT.JS WEB APPLICATION
               HOSTED ON VERCEL
                       │
             AUTHENTICATED API (/api/v1/*)
                       │
                       ▼
                POSTGRESQL DB
           (Persistent Job Queues)
                       ▲
                       │  Outbound HTTPS Polling (No inbound ports)
                       │  Bearer Token Authentication
                       ▼
              WINDOWS DESKTOP AGENT
            (Protected DPAPI Vault)
                       │
                       ▼
          WINDOWS PACKAGE MANAGER (WinGet)
                       │
                       ▼
             INSTALLED APPLICATIONS
```

---

## 2. Core Capabilities & Modules

1. **Authentication & User Management:** Protected sessions, RBAC, and cryptographically salted one-time agent pairing codes.
2. **Overview Dashboard:** Live telemetry, total software counts, available update counters, agent connection status, and operational activity streams.
3. **Application Inventory:** Comprehensive software catalog with package IDs, publishers, installed versions, sources (`winget`, `local_registry`, `arp`), search, sorting, filtering, and pagination.
4. **Update Intelligence Engine:** Multi-part Windows version comparator (`Major.Minor.Build.Revision`) and SemVer matching against upstream release manifests.
5. **Human-in-the-Loop Update Center:** Detailed pre-flight update previews with official changelog links, SHA-256 installer checksum verification, and mandatory user authorization.
6. **Windows Desktop Agent:** Lightweight, secure Windows service client with DPAPI credential vault, WinGet execution engine, and post-update version verification.
7. **History & Reporting:** Full lifecycle audit trail with diagnostic exit code logs, before/after version diffs, and instant CSV report exports.
8. **Security Insights:** Vulnerability advisory intelligence mapped against verified package IDs with transparency disclaimers.

---

## 3. Technology Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide React, Recharts.
- **Backend:** Next.js Serverless Route Handlers, Node.js, Zod validation schemas, layered services & repositories.
- **Database:** PostgreSQL with Prisma ORM (compatible with Neon, Supabase, Vercel Postgres, or local PostgreSQL).
- **Windows Agent:** TypeScript / Node.js Windows service, PowerShell quick-launcher (`UpdatePilot-Agent.ps1`), Windows DPAPI encrypted storage.
- **Testing:** Vitest automated test suite with unit, adapter, schema, and end-to-end integration tests.

---

## 4. Getting Started

### 4.1 Prerequisites
- Node.js (v18.0.0 or higher)
- Windows 10 or 11 with Windows Package Manager (`winget.exe`)

### 4.2 Installation
```bash
# Clone the repository
git clone https://github.com/your-org/updatepilot.git
cd updatepilot

# Install all workspace dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Build shared library and agent
npm --workspace=packages/shared run build
npm --workspace=agent run build
```

### 4.3 Running Locally
```bash
# Start the web dashboard (runs on http://localhost:3000)
npm run dev
```

---

## 5. Pairing the Windows Agent

1. Open `http://localhost:3000` in your browser.
2. Click **Connect Agent** -> **Generate Pairing Code** (e.g. `UP-892401`).
3. Open an elevated or standard PowerShell terminal in the project root:
   ```powershell
   # Pair host with dashboard
   .\agent\UpdatePilot-Agent.ps1 pair -Code UP-892401

   # Inspect pairing status and connectivity
   .\agent\UpdatePilot-Agent.ps1 status

   # Perform initial software inventory discovery
   .\agent\UpdatePilot-Agent.ps1 scan

   # Start the continuous outbound worker service
   .\agent\UpdatePilot-Agent.ps1 service
   ```

---

## 6. Running Automated Tests

UpdatePilot includes a comprehensive suite of unit and integration tests:

```bash
# Run all tests
npx vitest run

# Test files executed:
# ✓ tests/unit/versionComparator.test.ts
# ✓ tests/unit/wingetParser.test.ts
# ✓ tests/unit/schemas.test.ts
# ✓ tests/integration/services.test.ts
```

---

## 7. REST API Catalog

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard` | Overview statistics & recent activity | User |
| `GET` | `/api/v1/devices` | List registered Windows hosts | User |
| `POST` | `/api/v1/devices/generate-code` | Generate one-time 6-digit pairing code | User |
| `POST` | `/api/v1/devices/pair` | Handshake & exchange pairing code for agent token | Public |
| `DELETE` | `/api/v1/devices/:id` | Revoke agent credentials | User |
| `POST` | `/api/v1/devices/:id/scans` | Dispatch on-demand software scan job | User |
| `GET` | `/api/v1/applications` | Query inventory with search, filters, pagination | User |
| `GET` | `/api/v1/applications/:id` | Application manifest & release details | User |
| `GET` | `/api/v1/updates` | Query software packages with updates available | User |
| `POST` | `/api/v1/updates/:id/preview` | Pre-flight update verification & metadata check | User |
| `POST` | `/api/v1/updates/:id/execute` | User authorization & update job creation | User |
| `GET` | `/api/v1/jobs/:id` | Real-time job lifecycle state & diagnostics | User |
| `GET` | `/api/v1/history` | Paginated update & scan audit logs | User |
| `GET` | `/api/v1/history/export` | Download inventory or history CSV report | User |
| `GET` | `/api/v1/security/findings` | Verified security advisories & CVE mappings | User |
| `POST` | `/api/v1/agent/heartbeat` | Agent telemetry & online heartbeat | Agent |
| `GET` | `/api/v1/agent/jobs/poll` | Agent outbound pending job poll | Agent |
| `POST` | `/api/v1/agent/jobs/:id/claim` | Atomic job claim by agent | Agent |
| `POST` | `/api/v1/agent/jobs/:id/report` | Submit exit codes, logs & verification results | Agent |
| `POST` | `/api/v1/agent/scans/submit` | Synchronize discovered software inventory | Agent |

---

## 8. Deployment to Vercel

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full instructions on setting up managed PostgreSQL (Neon / Supabase), environment variables, and Vercel serverless deployment.

---

## 9. Engineering Documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — Functional and non-functional requirements baseline.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — High-level architecture, job lifecycle, and sequence diagrams.
- [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) — Database entity relationships, schema, and indexes.
- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) — Full REST API specifications.
- [`docs/SECURITY.md`](docs/SECURITY.md) — Threat model (STRIDE), allowlist rules, and credential encryption.
- [`docs/WINDOWS_AGENT.md`](docs/WINDOWS_AGENT.md) — Windows agent technical guide and WinGet integration.
- [`docs/TESTING.md`](docs/TESTING.md) — Test strategies, unit tests, and integration test coverage.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel and PostgreSQL deployment guide.
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — Step-by-step user walkthroughs.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — Diagnostic guide and common error resolutions.
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — Explicit scope boundaries and platform limitations.
- [`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) — Living engineering progress log.

---

## 10. License
UpdatePilot is distributed under the MIT License.
