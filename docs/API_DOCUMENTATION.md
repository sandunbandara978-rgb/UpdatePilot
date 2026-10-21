# UpdatePilot — REST API Specification Baseline

## 1. Global Conventions & Standards

- **Base URL:** `/api/v1`
- **Content-Type:** `application/json`
- **Authentication:**
  - **User Endpoints:** Secure HTTP-only session cookie or Bearer JWT token.
  - **Agent Endpoints:** `Authorization: Bearer <agent_token>` validated against SHA-256 hash in `AgentCredential`.
- **Standard Error Response Contract:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable description of error",
    "details": {}
  }
}
```

---

## 2. API Endpoints Catalog

### 2.0 User Authentication & Sessions
- **`POST /api/v1/auth/login`**
  - **Auth:** Public
  - **Request:** `{ "email": "admin@updatepilot.local", "password": "Password123!" }`
  - **Response:** `{ "user": { "id": "usr_...", "email": "admin@updatepilot.local", "name": "Local Administrator", "role": "ADMIN" }, "token": "session_..." }`
- **`POST /api/v1/auth/logout`**
  - **Auth:** Public / User
  - **Response:** `{ "message": "Successfully logged out" }`
- **`GET /api/v1/auth/me`**
  - **Auth:** Session Cookie / Bearer Token
  - **Response:** Current authenticated user object or 401 Unauthenticated.

### 2.1 Dashboard & Analytics
- **`GET /api/v1/dashboard`**
  - **Auth:** User
  - **Response:**
    - `totalApplications`: number
    - `updatesAvailable`: number
    - `upToDate`: number
    - `unsupported`: number
    - `unknown`: number
    - `activeDevicesCount`: number
    - `lastScanTimestamp`: ISO timestamp
    - `recentActivity`: list of recent jobs and audit events

### 2.2 Devices & Agent Pairing
- **`GET /api/v1/devices`**
  - **Auth:** User
  - **Response:** List of paired devices belonging to current user with online status, agent version, and last seen.
- **`POST /api/v1/devices/generate-code`**
  - **Auth:** User
  - **Response:** `{ "pairingCode": "UP-849201", "expiresAt": "2026-10-19T09:30:00Z" }`
- **`POST /api/v1/devices/pair`**
  - **Auth:** Public / Agent handshake
  - **Request:** `{ "pairingCode": "UP-849201", "deviceName": "WIN-DEV-01", "osVersion": "Windows 11 Pro 23H2", "agentVersion": "1.0.0" }`
  - **Response:** `{ "deviceId": "dev_123", "token": "agt_live_...", "pollingIntervalSec": 15 }`
- **`DELETE /api/v1/devices/:id`**
  - **Auth:** User (Owner)
  - **Action:** Revokes agent credentials and disconnects device.

### 2.3 Agent Outbound Heartbeat & Jobs Polling
- **`POST /api/v1/agent/heartbeat`**
  - **Auth:** Agent Bearer Token
  - **Request:** `{ "osVersion": "10.0.22631", "agentVersion": "1.0.0", "status": "ONLINE" }`
  - **Response:** `{ "acknowledged": true, "timestamp": "2026-10-19T09:15:00Z" }`
- **`GET /api/v1/agent/jobs/poll`**
  - **Auth:** Agent Bearer Token
  - **Response:** `{ "job": null | { "id": "job_...", "type": "SCAN | UPDATE", "payload": {} } }`
- **`POST /api/v1/agent/jobs/:id/claim`**
  - **Auth:** Agent Bearer Token
  - **Response:** `{ "claimed": true, "jobId": "job_..." }`
- **`POST /api/v1/agent/jobs/:id/report`**
  - **Auth:** Agent Bearer Token
  - **Request:**
    ```json
    {
      "status": "RUNNING | VERIFYING | COMPLETED | FAILED | RESTART_REQUIRED",
      "exitCode": 0,
      "logs": "Successfully installed Notepad++ v8.9.8.1",
      "verifiedVersion": "8.9.8.1"
    }
    ```
- **`POST /api/v1/agent/scans/submit`**
  - **Auth:** Agent Bearer Token
  - **Request:**
    ```json
    {
      "scanJobId": "scan_...",
      "applications": [
        {
          "name": "Notepad++ (64-bit x64)",
          "packageId": "Notepad++.Notepad++",
          "publisher": "Notepad++ Team",
          "installedVersion": "8.8.3",
          "availableVersion": "8.9.8.1",
          "source": "winget"
        }
      ]
    }
    ```

### 2.4 Application Inventory
- **`GET /api/v1/applications`**
  - **Auth:** User
  - **Query Params:** `deviceId`, `search`, `status`, `page`, `limit`, `sortBy`, `sortOrder`
  - **Response:** Paginated list of applications with metadata.
- **`GET /api/v1/applications/:id`**
  - **Auth:** User
  - **Response:** Detailed application profile, release history, changelog URLs, and security advisories.

### 2.5 Update Intelligence & Management
- **`GET /api/v1/updates`**
  - **Auth:** User
  - **Query Params:** `deviceId`
  - **Response:** Applications with `status === 'UPDATE_AVAILABLE'` and verified target versions.
- **`POST /api/v1/updates/:id/preview`**
  - **Auth:** User
  - **Response:** Pre-flight verification data: verified package identity, installer source, changelog link, target version, sha256 checksum, and estimated risk warnings.
- **`POST /api/v1/updates/:id/execute`**
  - **Auth:** User
  - **Request:** `{ "confirmed": true, "acknowledgedTargetVersion": "8.9.8.1" }`
  - **Response:** `{ "jobId": "job_upd_...", "status": "QUEUED" }`

### 2.6 Job Tracking & History
- **`GET /api/v1/jobs/:id`**
  - **Auth:** User
  - **Response:** Real-time state of the job (`QUEUED`, `RUNNING`, `VERIFYING`, `COMPLETED`, `FAILED`, `RESTART_REQUIRED`), exit code, and execution summary.
- **`GET /api/v1/history`**
  - **Auth:** User
  - **Query Params:** `type` (scan|update|all), `page`, `limit`
  - **Response:** Paginated log of historical scan runs, update attempts, exit codes, and timestamps.
- **`GET /api/v1/history/export`**
  - **Auth:** User
  - **Query Params:** `format` (csv|json)
  - **Response:** Direct download of CSV or JSON export.

### 2.7 Security Insights
- **`GET /api/v1/security/findings`**
  - **Auth:** User
  - **Response:** List of security advisories mapped to installed software, source citations, severity metrics, and advisory freshness timestamps.
