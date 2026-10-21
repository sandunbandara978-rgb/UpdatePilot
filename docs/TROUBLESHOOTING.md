# UpdatePilot — Diagnostics & Troubleshooting Guide

## 1. Quick Diagnostic Checklist
Before troubleshooting deeper, verify these prerequisites:
- Run `node -v` (Must be v18.0.0 or newer).
- Run `winget --version` (Windows Package Manager must be installed and functional).
- Run `.\agent\UpdatePilot-Agent.ps1 status` to inspect agent pairing state.

---

## 2. Common Issues & Solutions

### 2.1 WinGet Prompts for Store Source Agreements
- **Symptom:** WinGet outputs: `The msstore source requires that you view the following agreements... Do you agree? [Y] Yes [N] No`
- **Cause:** Microsoft Store source agreement has not been acknowledged on this Windows machine.
- **Resolution:**
  Run the following command once in PowerShell:
  ```powershell
  winget source update --accept-source-agreements
  ```
  The UpdatePilot agent automatically passes `--accept-source-agreements` on all internal commands to prevent blocking prompts.

### 2.2 Agent Reports "Not Paired"
- **Symptom:** `Pairing Status: Not Paired` when running `UpdatePilot-Agent.ps1 status`.
- **Resolution:**
  1. Open the UpdatePilot dashboard in your browser.
  2. Click **Connect Agent** -> **Generate Pairing Code**.
  3. Execute:
     ```powershell
     .\agent\UpdatePilot-Agent.ps1 pair -Code <YOUR_CODE>
     ```
  4. If your server is hosted remotely, specify the `-Server` parameter:
     ```powershell
     .\agent\UpdatePilot-Agent.ps1 pair -Code <YOUR_CODE> -Server https://your-domain.vercel.app
     ```

### 2.3 Update Fails or Returns Non-Zero Exit Code
- **Symptom:** Update job enters state `FAILED` with an exit code like `1603` or `1619`.
- **Causes & Resolutions:**
  - **Application is currently open / running:** Close the target application (e.g. close Notepad++ or Firefox before upgrading).
  - **Elevation / UAC required:** If the installer requires administrator permissions, run the agent in an elevated (Administrator) PowerShell terminal.
  - **Exit Code 3010 (Reboot Required):** This indicates the installation succeeded but the Windows OS requires a system reboot. UpdatePilot records this cleanly as `RESTART_REQUIRED` rather than an error.

### 2.4 Software Displays as "Unmatched" or "Unsupported"
- **Symptom:** An application appears in the inventory with status `UNMATCHED` or `UNSUPPORTED`.
- **Explanation:**
  UpdatePilot enforces strict trust policies. If an installed application was installed via a custom proprietary script or legacy installer not registered in the WinGet community or Microsoft Store catalog, UpdatePilot safely displays it as `UNMATCHED` without inventing fake versions or commands.
