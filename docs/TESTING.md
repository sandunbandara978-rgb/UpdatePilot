# UpdatePilot — Automated Testing & Quality Assurance Baseline

## 1. Testing Philosophy & Strategy
UpdatePilot implements a comprehensive multi-tier testing strategy ensuring that all critical business logic, security policies, package management adapters, and job lifecycles are rigorously verified.

```text
               ┌──────────────────────┐
               │ End-to-End Tests     │   Complete Update Lifecycle & UI Verification
               ├──────────────────────┤
               │ Integration Tests    │   Services, Repositories, API Handlers & Auth
               ├──────────────────────┤
               │ Unit Tests           │   Version Comparator, WinGet Parser, Schemas
               └──────────────────────┘
```

---

## 2. Test Suites Overview

### 2.1 Unit Tests
Located in `tests/unit/`:
- **`versionComparator.test.ts`**:
  - Validates multi-part Windows versions (`Major.Minor.Build.Revision`).
  - Tests SemVer, prefix cleanup (`v1.2.3`), architecture tags, and whitespace normalization.
  - Verifies that `isUpdateAvailable('8.8.3', '8.9.8.1')` evaluates to `true` and identical versions return `false`.
- **`wingetParser.test.ts`**:
  - Tests fixed-width parsing of real `winget list` output.
  - Verifies ARP and machine package filtering.
  - Validates key-value extraction from `winget show` (release notes URL, SHA256 checksum, license).
  - Tests rejection of malicious shell arguments in package IDs (`evil; rm -rf / ;`).
- **`schemas.test.ts`**:
  - Validates strict Zod schemas against allowlist regular expressions (`SAFE_PACKAGE_ID_REGEX`).
  - Verifies that unconfirmed update execution payloads throw validation errors.

### 2.2 Integration Tests
Located in `tests/integration/`:
- **`services.test.ts`**:
  - Executes the full 5-step operational lifecycle:
    1. One-time pairing code generation & agent cryptographic registration.
    2. Outbound heartbeat & bearer token verification.
    3. Software scan payload processing & inventory state categorization.
    4. Pre-flight update preview with version mismatch protection.
    5. Confirmed update execution, atomic job claiming, and post-update verification check.

---

## 3. Running the Test Suite

```bash
# Run all unit and integration tests
npx vitest run

# Run tests in interactive watch mode
npm run test:watch

# Run TypeScript typechecks across all packages
npm run typecheck
```
