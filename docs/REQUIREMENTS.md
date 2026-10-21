# UpdatePilot — Requirements Traceability & Specification Baseline

## 1. Document Overview
This document records the complete functional and non-functional requirements baseline for **UpdatePilot (Software Update Intelligence & Management Platform)**, derived from `UpdatePilot_Project_Proposal.pdf` and the Industrial Master Prompt V2.0.

---

## 2. Project Vision & Mission
UpdatePilot is an industrial-quality, Windows-first software update intelligence platform. It bridges a modern Next.js/React web dashboard (hosted on Vercel) with a locally installed Windows Agent via secure outbound HTTPS. UpdatePilot discovers installed applications, resolves trusted package identities, checks for verified updates using Windows Package Manager (WinGet), provides official release metadata/changelogs, executes updates only upon explicit user confirmation, and strictly verifies post-update versions.

---

## 3. Functional Requirements Traceability Matrix

| Requirement ID | Description | Priority | Architecture Layer | Implementation Target | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Securely pair, identify, authenticate, and revoke local Windows agent | **MUST** | Auth / Backend / Agent | Pairing code exchange (one-time, time-bound), hashed tokens, DPAPI credential storage, revocation flag | Automated integration test & Agent handshake test |
| **FR-02** | Discover installed applications on Windows host and persist scan results | **MUST** | Agent / Backend / DB | WinGet scan engine + Registry/ARP fallback, structured payload over HTTPS, database inventory snapshot | Unit test parser + live test against local host |
| **FR-03** | Match detected applications to trusted package identities | **MUST** | Agent / Update Intelligence | WinGet ID mapping, source resolution (`winget`, `msstore`), publisher validation | Unit tests with real package IDs |
| **FR-04** | Compare installed and available versions accurately | **MUST** | Update Intelligence Engine | Semantic / Windows version comparison engine (`SemVer` + four-part Windows version comparator `Major.Minor.Build.Revision`) | Unit tests with edge case version strings |
| **FR-05** | Show application details and official release metadata when available | **MUST** | Backend / Web UI / Agent | Release notes URL, publisher URL, license, SHA256, installer type, release date cached in `ReleaseMetadata` | API integration test & UI rendering test |
| **FR-06** | Search, filter, sort, and paginate application inventory | **MUST** | Frontend / API / DB | Full-text query, status filters (Update Available, Up to Date, Unknown, Unsupported), sorting by name/publisher/date, cursor/offset pagination | API test suite & UI component tests |
| **FR-07** | Execute a supported update only after explicit user confirmation | **MUST** | Web UI / API / DB / Agent | Confirmation dialog modal with source & target version; creation of persistent `UpdateJob` in state `QUEUED`; agent claims job | E2E test + UI confirmation gate |
| **FR-08** | Verify resulting installed version post-update and record verified outcome | **MUST** | Agent / DB / API | Agent executes update, captures exit code, triggers immediate localized rescan, compares installed version against target version | Mocked & live verification tests |
| **FR-09** | Persist scan and update history with useful diagnostic details | **MUST** | DB / Backend / Web UI | `ScanJob`, `UpdateJob`, `AuditEvent` tables with timestamps, initiator, stdout/stderr diagnostic summaries, exit codes | DB query tests & UI History view |
| **FR-10** | Display security information only when match and source are reliable | **SHOULD** | Security Module / Web UI | CVE/advisory ingestion via OSV/GitHub Advisories for verified package IDs; explicit data limitations notice | Unit test advisory matcher & UI card |
| **FR-11** | Export inventory and update reports | **SHOULD** | API / Web UI | CSV/JSON export with selected columns, audit trail export | Unit test CSV generator & browser download |
| **FR-12** | Responsive layouts, keyboard navigation, and light/dark themes | **MUST** | Web UI / Design System | Tailwind CSS v3/v4 design tokens, Radix UI primitives, dark mode provider, WCAG 2.2 AA compliant contrast | Playwright visual & accessibility checks |
| **FR-13** | Support scheduled scans and configurable notifications | **COULD** | Settings / Agent / API | Background scan interval preference, in-app notification toasts and badges | Settings persistence test |
| **FR-14** | Support other operating systems (macOS, Linux) | **FUTURE** | Platform Architecture | Architecture modularized with package manager adapter interface | Design review |

---

## 4. Non-Functional Requirements (NFR)

1. **Security & Least Privilege:**
   - No arbitrary shell execution from web or API.
   - Operations restricted to strict allowlisted commands (`winget upgrade --id <ValidatedPackageId>`).
   - One-time pairing code expires in 10 minutes.
   - Agent tokens stored using secure hashing (SHA-256 with salt) in DB; agent stores token locally using Windows Data Protection API (DPAPI) or encrypted credential store.
   - Input sanitization on all endpoints using Zod schemas.

2. **Reliability & Idempotency:**
   - Outbound HTTPS polling model (long-polling / interval polling) ensures agent works behind NAT/firewalls without inbound ports.
   - Serverless-safe background job lifecycle: `QUEUED` -> `CLAIMED` -> `RUNNING` -> `VERIFYING` -> `COMPLETED` / `FAILED` / `RESTART_REQUIRED`.
   - Stale job expiration: Jobs unclaimed or stuck in running state exceed timeout are marked `TIMED_OUT` or `INTERRUPTED`.

3. **Data Integrity:**
   - Relational foreign keys and cascade rules in PostgreSQL via Prisma.
   - Historical snapshots preserved: scanning does not blindly wipe out historical records.
   - Transaction boundaries for update approval and job claiming.

4. **Performance:**
   - Database queries indexed on `deviceId`, `packageId`, `status`, `userId`, `createdAt`.
   - Inventory API paginated (default 20 items per page).
   - Fast cold starts on Vercel Edge/Serverless.

5. **Accessibility (a11y):**
   - WCAG 2.2 AA target.
   - High-contrast color scales (dark/light themes).
   - Accessible keyboard focus rings, screen reader ARIA labels, semantic HTML.

---

## 5. Scope Boundaries

### In Scope for MVP:
- Windows 10/11 environments with WinGet.
- Web dashboard with Next.js App Router, React, Tailwind CSS, Lucide icons, Recharts.
- Local Windows Agent (TypeScript/Node.js CLI executable with PowerShell launcher, WinGet integration, DPAPI credential storage).
- Complete scan -> match -> version compare -> preview -> user confirm -> execute -> verify post-update loop.
- Full audit log & CSV report export.
- Clean code architecture, complete tests, comprehensive documentation.

### Explicitly Out of Scope:
- Silent unattended or auto-updating background daemons without user approval.
- Guaranteed support for non-WinGet proprietary software (these are categorized gracefully as `UNSUPPORTED` or `UNMATCHED`).
- Arbitrary terminal command execution.
- Fleet management / multi-tenant enterprise domain group policies.
