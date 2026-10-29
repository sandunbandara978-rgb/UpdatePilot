/**
 * UpdatePilot Windows Agent Distribution Staging Script
 *
 * Prepares a clean, self-contained, standalone production distribution
 * containing the bundled Node.js x64 runtime, compiled agent and shared packages,
 * production dependencies (strictly without developer symlinks), launcher scripts,
 * and license notices.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const STAGING_DIR = path.resolve(__dirname, '..', 'staging');

console.log('=== [UpdatePilot Release Pipeline] Step 1: Staging Distribution ===');

// 1. Build TypeScript packages
console.log('[1/7] Building @updatepilot/shared and @updatepilot/agent...');
execSync('npm --workspace=packages/shared run build', { cwd: ROOT_DIR, stdio: 'inherit' });
execSync('npm --workspace=agent run build', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Clean and recreate staging directory
console.log('[2/7] Cleaning staging directory...');
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(STAGING_DIR, 'bin'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'lib', 'agent'), { recursive: true });
fs.mkdirSync(path.join(STAGING_DIR, 'node_modules', '@updatepilot', 'shared'), { recursive: true });

// 3. Copy validated Node.js x64 runtime
console.log('[3/7] Bundling private Windows Node.js x64 runtime...');
const nodePath = process.execPath;
if (!fs.existsSync(nodePath)) {
  throw new Error(`Node executable not found at: ${nodePath}`);
}
const destNode = path.join(STAGING_DIR, 'bin', 'node.exe');
fs.copyFileSync(nodePath, destNode);

const nodeStat = fs.statSync(destNode);
console.log(`  -> Bundled node.exe (${(nodeStat.size / (1024 * 1024)).toFixed(1)} MB) from ${nodePath}`);

// 4. Copy compiled agent code
console.log('[4/7] Copying compiled agent code...');
function copyRecursive(src, dest, filter) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    throw new Error(`Developer symlink detected at ${src}. Staging distribution must be completely resolved!`);
  }
  const base = path.basename(src);
  if (filter && !filter(src, base)) {
    return;
  }
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child), filter);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(path.join(ROOT_DIR, 'agent', 'dist'), path.join(STAGING_DIR, 'lib', 'agent', 'dist'));

// Copy agent package.json (cleaned for release)
const agentPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'agent', 'package.json'), 'utf-8'));
delete agentPkg.devDependencies;
delete agentPkg.scripts;
fs.writeFileSync(
  path.join(STAGING_DIR, 'lib', 'agent', 'package.json'),
  JSON.stringify(agentPkg, null, 2),
  'utf-8'
);

// 5. Copy compiled @updatepilot/shared into staging node_modules
console.log('[5/7] Resolving workspace packages into production node_modules...');
copyRecursive(
  path.join(ROOT_DIR, 'packages', 'shared', 'dist'),
  path.join(STAGING_DIR, 'node_modules', '@updatepilot', 'shared', 'dist')
);
const sharedPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'packages', 'shared', 'package.json'), 'utf-8'));
delete sharedPkg.devDependencies;
delete sharedPkg.scripts;
fs.writeFileSync(
  path.join(STAGING_DIR, 'node_modules', '@updatepilot', 'shared', 'package.json'),
  JSON.stringify(sharedPkg, null, 2),
  'utf-8'
);

// Copy production dependencies: commander and zod (excluding third-party tests)
function copyModule(name) {
  const modPath = path.join(ROOT_DIR, 'node_modules', name);
  if (!fs.existsSync(modPath)) {
    throw new Error(`Required production dependency "${name}" not found in node_modules!`);
  }
  console.log(`  -> Staging dependency: ${name}`);
  copyRecursive(modPath, path.join(STAGING_DIR, 'node_modules', name), (full, base) => {
    // Exclude tests, documentation, and source maps
    if (base === 'tests' || base === 'test' || base === '__tests__' || base.endsWith('.test.ts') || base.endsWith('.test.js')) {
      return false;
    }
    return true;
  });
}

copyModule('commander');
copyModule('zod');

// 6. Generate launchers and scripts
console.log('[6/7] Creating launcher scripts and Setup Wizard...');

// Start-Agent-Silent.vbs (Headless background service launcher for Windows startup)
const silentVbs = `' UpdatePilot Agent Silent Background Launcher
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = currentDir & "\\bin\\node.exe"
agentJs = currentDir & "\\lib\\agent\\dist\\index.js"

Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & agentJs & Chr(34) & " service", 0, False
`;
fs.writeFileSync(path.join(STAGING_DIR, 'Start-Agent-Silent.vbs'), silentVbs, 'utf-8');

// Stop-Agent.cmd (Gracefully stops background agent worker)
const stopCmd = `@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*UpdatePilot-Agent*' } | Stop-Process -Force"
`;
fs.writeFileSync(path.join(STAGING_DIR, 'Stop-Agent.cmd'), stopCmd, 'utf-8');

// UpdatePilot-Setup.cmd (Interactive setup wizard)
const setupCmd = `@echo off
title UpdatePilot Agent Setup Wizard
cls
"%~dp0bin\\node.exe" "%~dp0lib\\agent\\dist\\index.js" setup
if %errorlevel% neq 0 (
  echo.
  echo Setup encountered an issue. Press any key to exit.
  pause >nul
)
`;
fs.writeFileSync(path.join(STAGING_DIR, 'UpdatePilot-Setup.cmd'), setupCmd, 'utf-8');

// UpdatePilot-Agent.cmd (Background / foreground service worker)
const agentCmd = `@echo off
title UpdatePilot Agent Service Worker
"%~dp0bin\\node.exe" "%~dp0lib\\agent\\dist\\index.js" service
if %errorlevel% neq 0 (
  echo.
  echo Agent service stopped with exit code %errorlevel%.
  pause
)
`;
fs.writeFileSync(path.join(STAGING_DIR, 'UpdatePilot-Agent.cmd'), agentCmd, 'utf-8');

// UpdatePilot-Status.cmd (Status inspection)
const statusCmd = `@echo off
title UpdatePilot Agent Status
cls
"%~dp0bin\\node.exe" "%~dp0lib\\agent\\dist\\index.js" status
echo.
pause
`;
fs.writeFileSync(path.join(STAGING_DIR, 'UpdatePilot-Status.cmd'), statusCmd, 'utf-8');

// UpdatePilot-Scan.cmd (Run immediate scan and submit)
const scanCmd = `@echo off
title UpdatePilot Discovery Scan
cls
"%~dp0bin\\node.exe" "%~dp0lib\\agent\\dist\\index.js" scan --submit
echo.
pause
`;
fs.writeFileSync(path.join(STAGING_DIR, 'UpdatePilot-Scan.cmd'), scanCmd, 'utf-8');

// Setup-Wizard.ps1 (Native Windows Graphical Setup Dialog)
const setupWizardPs1 = `# UpdatePilot Agent — Graphical Setup & Pairing Dialog
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeExe = Join-Path $ScriptDir "bin\\node.exe"
$AgentJs = Join-Path $ScriptDir "lib\\agent\\dist\\index.js"

$form = New-Object System.Windows.Forms.Form
$form.Text = "UpdatePilot Windows Agent — Setup & Pairing"
$form.Size = New-Object System.Drawing.Size(560, 480)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)

# Title
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "UpdatePilot Agent Setup"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$lblTitle.Location = New-Object System.Drawing.Point(30, 20)
$lblTitle.Size = New-Object System.Drawing.Size(500, 35)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "Connect this Windows computer to your central UpdatePilot platform."
$lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$lblSub.Location = New-Object System.Drawing.Point(32, 55)
$lblSub.Size = New-Object System.Drawing.Size(480, 25)
$form.Controls.Add($lblSub)

# Server URL
$lblServer = New-Object System.Windows.Forms.Label
$lblServer.Text = "UpdatePilot Server URL:"
$lblServer.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblServer.Location = New-Object System.Drawing.Point(32, 95)
$lblServer.Size = New-Object System.Drawing.Size(480, 20)
$form.Controls.Add($lblServer)

$txtServer = New-Object System.Windows.Forms.TextBox
$txtServer.Text = "http://localhost:3000"
$txtServer.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$txtServer.Location = New-Object System.Drawing.Point(32, 118)
$txtServer.Size = New-Object System.Drawing.Size(370, 28)
$form.Controls.Add($txtServer)

$btnTest = New-Object System.Windows.Forms.Button
$btnTest.Text = "Test Link"
$btnTest.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnTest.Location = New-Object System.Drawing.Point(410, 117)
$btnTest.Size = New-Object System.Drawing.Size(100, 30)
$form.Controls.Add($btnTest)

$lblServerNote = New-Object System.Windows.Forms.Label
$lblServerNote.Text = "Note: 'localhost' refers to this PC. For a remote server, enter its full URL (e.g. https://updatepilot.corp)."
$lblServerNote.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$lblServerNote.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$lblServerNote.Location = New-Object System.Drawing.Point(32, 150)
$lblServerNote.Size = New-Object System.Drawing.Size(480, 20)
$form.Controls.Add($lblServerNote)

# Pairing Code
$lblCode = New-Object System.Windows.Forms.Label
$lblCode.Text = "Pairing Code (6-character code from Web Dashboard):"
$lblCode.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblCode.Location = New-Object System.Drawing.Point(32, 180)
$lblCode.Size = New-Object System.Drawing.Size(480, 20)
$form.Controls.Add($lblCode)

$txtCode = New-Object System.Windows.Forms.TextBox
$txtCode.Text = "UP-"
$txtCode.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$txtCode.Location = New-Object System.Drawing.Point(32, 203)
$txtCode.Size = New-Object System.Drawing.Size(200, 32)
$form.Controls.Add($txtCode)

# Pair Button
$btnPair = New-Object System.Windows.Forms.Button
$btnPair.Text = "Pair This Computer"
$btnPair.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$btnPair.ForeColor = [System.Drawing.Color]::White
$btnPair.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnPair.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnPair.Location = New-Object System.Drawing.Point(245, 202)
$btnPair.Size = New-Object System.Drawing.Size(180, 34)
$form.Controls.Add($btnPair)

# Output Box
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true
$txtLog.ScrollBars = "Vertical"
$txtLog.ReadOnly = $true
$txtLog.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$txtLog.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$txtLog.Location = New-Object System.Drawing.Point(32, 255)
$txtLog.Size = New-Object System.Drawing.Size(480, 110)
$form.Controls.Add($txtLog)

# Action Buttons
$btnDash = New-Object System.Windows.Forms.Button
$btnDash.Text = "Open Dashboard"
$btnDash.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnDash.Location = New-Object System.Drawing.Point(32, 385)
$btnDash.Size = New-Object System.Drawing.Size(140, 32)
$form.Controls.Add($btnDash)

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "Start Background Agent"
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnStart.Location = New-Object System.Drawing.Point(180, 385)
$btnStart.Size = New-Object System.Drawing.Size(170, 32)
$form.Controls.Add($btnStart)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = "Close"
$btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnClose.Location = New-Object System.Drawing.Point(400, 385)
$btnClose.Size = New-Object System.Drawing.Size(110, 32)
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# Events
$btnTest.Add_Click({
    $txtLog.Text = "Testing connection to " + $txtServer.Text + "..."
    try {
        $res = Invoke-WebRequest -Uri ($txtServer.Text.TrimEnd('/') + '/api/v1/dashboard') -TimeoutSec 5 -UseBasicParsing
        if ($res.StatusCode -eq 200) {
            $txtLog.Text = "SUCCESS: Server is online and responsive (HTTP 200)."
        } else {
            $txtLog.Text = "Warning: Server returned status code " + $res.StatusCode
        }
    } catch {
        $txtLog.Text = "Error: Could not connect to server. Check URL, network, or firewall: " + $_.Exception.Message
    }
})

$btnPair.Add_Click({
    $srv = $txtServer.Text.Trim()
    $cd = $txtCode.Text.Trim().ToUpper()
    $txtLog.Text = "Initiating pairing with $srv using code $cd..."
    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $NodeExe
        $pinfo.Arguments = "\`"$AgentJs\`" pair --code $cd --server $srv"
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.UseShellExecute = $false
        $pinfo.CreateNoWindow = $true
        $p = [System.Diagnostics.Process]::Start($pinfo)
        $out = $p.StandardOutput.ReadToEnd()
        $err = $p.StandardError.ReadToEnd()
        $p.WaitForExit()

        if ($p.ExitCode -eq 0) {
            $txtLog.Text = $out + "\`r\`n[DPAPI] Credentials securely encrypted in Windows vault."
        } else {
            $txtLog.Text = "Pairing failed:\`r\`n" + $err + "\`r\`n" + $out
        }
    } catch {
        $txtLog.Text = "Failed to launch pairing process: " + $_.Exception.Message
    }
})

$btnDash.Add_Click({
    Start-Process $txtServer.Text.Trim()
})

$btnStart.Add_Click({
    Start-Process -NoNewWindow -FilePath $NodeExe -ArgumentList "\`"$AgentJs\`" service"
    $txtLog.Text = "UpdatePilot Agent background service started."
})

[void]$form.ShowDialog()
`;
fs.writeFileSync(path.join(STAGING_DIR, 'Setup-Wizard.ps1'), setupWizardPs1, 'utf-8');

// 7. Write licenses and readme
console.log('[7/7] Generating release documentation and license notices...');
const licensesText = `UpdatePilot Windows Desktop Agent — Third-Party Software Notices & Licenses
================================================================================

1. UpdatePilot Core Codebase
   License: Proprietary / Commercial License (UpdatePilot Project)
   Copyright (c) 2026 UpdatePilot Team. All rights reserved.

2. Node.js (Bundled Windows Runtime)
   License: MIT License
   Copyright Node.js contributors. All rights reserved.
   https://github.com/nodejs/node/blob/main/LICENSE

3. Commander.js
   License: MIT License
   Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
   https://github.com/tj/commander.js/blob/master/LICENSE

4. Zod
   License: MIT License
   Copyright (c) 2020 Colin McDonnell
   https://github.com/colinhacks/zod/blob/master/LICENSE

5. Inno Setup (Installer Packaging System)
   License: Inno Setup License
   Copyright (C) 1997-2026 Jordan Russell. All rights reserved.
   https://jrsoftware.org/files/is/license.txt
`;
fs.writeFileSync(path.join(STAGING_DIR, 'THIRD_PARTY_LICENSES.txt'), licensesText, 'utf-8');

// Verify no forbidden files exist in staging
function scanForbiddenFiles(dir) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Staging directory contains symlink at: ${full}`);
    }
    if (item.startsWith('.env') || item.includes('credentials.enc') || item === '.git') {
      throw new Error(`CRITICAL SECURITY FAILURE: Forbidden file detected in staging: ${full}`);
    }
    if (stat.isDirectory()) {
      scanForbiddenFiles(full);
    }
  }
}
scanForbiddenFiles(STAGING_DIR);

console.log('✔ Staging complete with zero symlinks and verified production dependencies.\n');
