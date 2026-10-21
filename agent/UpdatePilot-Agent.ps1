<#
.SYNOPSIS
    UpdatePilot Desktop Agent — Windows Launcher Script
.DESCRIPTION
    Launches and manages the UpdatePilot Windows Desktop Agent.
    Supports pairing, software inventory scanning, and running the background worker service.
#>

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("pair", "scan", "service", "status", "unpair", "help")]
    [string]$Command = "status",

    [Parameter()]
    [string]$Code = "",

    [Parameter()]
    [string]$Server = "http://localhost:3000"
)

$Host.UI.RawUI.WindowTitle = "UpdatePilot Windows Agent"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UpdatePilot — Software Update Intelligence Platform   " -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "                   Windows Desktop Agent                  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js runtime
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Host "[ERROR] Node.js runtime was not found in your PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) to run the UpdatePilot Windows Agent." -ForegroundColor Yellow
    exit 1
}

# Check WinGet
$WinGetPath = (Get-Command winget -ErrorAction SilentlyContinue).Source
if (-not $WinGetPath) {
    Write-Host "[WARNING] WinGet (Windows Package Manager) was not found." -ForegroundColor Yellow
    Write-Host "Install App Installer from the Microsoft Store or github.com/microsoft/winget-cli" -ForegroundColor Gray
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Execute agent with tsx or node dist/index.js
if (Test-Path "$ScriptDir\dist\index.js") {
    $Runner = "node"
    $Entry = "$ScriptDir\dist\index.js"
} else {
    $Runner = "npx"
    $Entry = "tsx src/index.ts"
}

switch ($Command) {
    "pair" {
        if (-not $Code) {
            $Code = Read-Host "Enter the 6-digit pairing code from your UpdatePilot Dashboard"
        }
        & $Runner $Entry.Split(' ') pair --code $Code --server $Server
    }
    "scan" {
        & $Runner $Entry.Split(' ') scan
    }
    "service" {
        & $Runner $Entry.Split(' ') service
    }
    "status" {
        & $Runner $Entry.Split(' ') status
    }
    "unpair" {
        & $Runner $Entry.Split(' ') unpair
    }
    Default {
        & $Runner $Entry.Split(' ') --help
    }
}
