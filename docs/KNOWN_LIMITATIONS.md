# UpdatePilot — Known Limitations & Architectural Boundaries

## 1. Scope & Platform Boundaries
1. **Windows-First Architecture:**
   - UpdatePilot V1.0 is engineered specifically for Windows 10 (version 1809+) and Windows 11.
   - Cross-platform support for macOS (Homebrew) and Linux (APT/DNF) is deferred to future releases (FR-14).

2. **Windows Package Manager (WinGet) Dependency:**
   - Application package matching, upstream release notes, and automated silent upgrades depend on WinGet availability.
   - Applications installed outside package registries (e.g., custom portable executables or internal scripts) are classified as `UNMATCHED` or `UNSUPPORTED`.

3. **No Unattended Auto-Updating:**
   - By design, UpdatePilot never performs unattended or silent bulk auto-updates without user review.
   - Every update requires explicit confirmation with the target version displayed.

4. **In-Use File Locks:**
   - Certain Windows applications (e.g. web browsers or IDEs) lock their executables while running. If an update is triggered while the application is active, the installer may report exit code `1603` or exit code `3010` (Reboot Required).

5. **Code Signing:**
   - In development environments, the Windows agent runs via Node.js or PowerShell without an Extended Validation (EV) code-signing certificate. Windows SmartScreen may present a standard informational prompt on first run.
