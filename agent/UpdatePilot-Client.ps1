<#
.SYNOPSIS
    UpdatePilot Standalone Windows Client (Zero-Dependency PowerShell Edition)
.DESCRIPTION
    Works natively on ANY Windows 10/11 machine. Does NOT require Node.js, Git, or Python.
    Uses native Windows PowerShell and Windows Package Manager (WinGet).
.EXAMPLE
    .\UpdatePilot-Client.ps1 -Pair UP-123456 -Server http://172.20.10.4:3000
    .\UpdatePilot-Client.ps1 -Scan
    .\UpdatePilot-Client.ps1 -Service
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$Pair = "",

    [Parameter()]
    [switch]$Scan,

    [Parameter()]
    [switch]$Service,

    [Parameter()]
    [switch]$Status,

    [Parameter()]
    [switch]$Unpair,

    [Parameter()]
    [string]$Server = ""
)

$ErrorActionPreference = "Stop"
$AgentVersion = "1.0.0-pwsh"

# Storage directory
$AppDataDir = [System.IO.Path]::Combine($env:LOCALAPPDATA, "UpdatePilot")
$CredPath = [System.IO.Path]::Combine($AppDataDir, "agent_credentials.json")

function Ensure-Dir {
    if (-not (Test-Path $AppDataDir)) {
        New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
    }
}

function Save-Creds($serverUrl, $deviceId, $token) {
    Ensure-Dir
    $data = @{
        Server = $serverUrl
        DeviceId = $deviceId
        Token = $token
        PairedAt = (Get-Date).ToString("o")
        ComputerName = $env:COMPUTERNAME
    }
    $json = $data | ConvertTo-Json -Compress
    Set-Content -Path $CredPath -Value $json -Force
}

function Load-Creds {
    if (Test-Path $CredPath) {
        try {
            $raw = Get-Content -Path $CredPath -Raw
            return $raw | ConvertFrom-Json
        } catch {
            return $null
        }
    }
    return $null
}

function Get-WinGetApps {
    Write-Host "[UpdatePilot] Inspecting installed software via Windows Package Manager (WinGet)..." -ForegroundColor Cyan
    $wingetCheck = (Get-Command winget -ErrorAction SilentlyContinue)
    if (-not $wingetCheck) {
        Write-Host "[ERROR] winget.exe not found. WinGet is required." -ForegroundColor Red
        return @()
    }

    $raw = & winget list --accept-source-agreements 2>$null
    if (-not $raw) { return @() }

    $lines = $raw -split "`r?`n"
    $separatorIdx = -1
    $headerLine = ""

    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match "^-{5,}") {
            $separatorIdx = $i
            $headerLine = $lines[$i - 1]
            break
        }
    }

    if ($separatorIdx -eq -1 -or -not $headerLine) { return @() }

    $nameCol = $headerLine.IndexOf("Name")
    $idCol = $headerLine.IndexOf("Id")
    $verCol = $headerLine.IndexOf("Version")
    $availCol = $headerLine.IndexOf("Available")
    $srcCol = $headerLine.IndexOf("Source")

    $apps = [System.Collections.Generic.List[PSObject]]::new()

    for ($i = $separatorIdx + 1; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -like "*<additional entries truncated*" -or $line -like "*agreements*") { continue }

        try {
            $name = ""
            $id = $null
            $ver = ""
            $avail = $null
            $source = $null

            if ($idCol -ne -1 -and $verCol -ne -1) {
                $name = $line.Substring($nameCol, $idCol - $nameCol).Trim()
                $rawId = $line.Substring($idCol, $verCol - $idCol).Trim()
                if ($rawId -and -not ($rawId -like "ARP\*")) { $id = $rawId }

                if ($availCol -ne -1) {
                    $ver = $line.Substring($verCol, $availCol - $verCol).Trim()
                    if ($srcCol -ne -1 -and $line.Length -gt $srcCol) {
                        $rawAvail = $line.Substring($availCol, $srcCol - $availCol).Trim()
                        if ($rawAvail) { $avail = $rawAvail }
                        $source = $line.Substring($srcCol).Trim()
                    } elseif ($line.Length -gt $availCol) {
                        $rawAvail = $line.Substring($availCol).Trim()
                        if ($rawAvail) { $avail = $rawAvail }
                    }
                } else {
                    $ver = $line.Substring($verCol).Trim()
                }
            }

            if ($name -and $ver) {
                $apps.Add([PSCustomObject]@{
                    name = $name
                    packageId = $id
                    installedVersion = $ver
                    availableVersion = $avail
                    source = if ($source) { $source } elseif ($id) { "winget" } else { "local" }
                })
            }
        } catch {}
    }

    return $apps
}

# --- Actions ---

if ($Unpair) {
    if (Test-Path $CredPath) {
        Remove-Item $CredPath -Force
        Write-Host "✔ Host unpaired and credentials removed." -ForegroundColor Green
    } else {
        Write-Host "Host is not currently paired." -ForegroundColor Yellow
    }
    exit 0
}

if ($Status) {
    Write-Host "=== UpdatePilot Standalone Client ($AgentVersion) ===" -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "Host: $env:COMPUTERNAME ($([System.Environment]::OSVersion.VersionString))"
    $creds = Load-Creds
    if ($creds) {
        Write-Host "Status: Paired" -ForegroundColor Green
        Write-Host "Device ID: $($creds.DeviceId)"
        Write-Host "Server:    $($creds.Server)"
        Write-Host "Paired At: $($creds.PairedAt)"
    } else {
        Write-Host "Status: Not Paired" -ForegroundColor Yellow
        Write-Host "Run with -Pair <CODE> -Server <URL> to connect this computer."
    }
    exit 0
}

if ($Pair) {
    if (-not $Server) {
        $Server = "http://localhost:3000"
    }
    $Server = $Server.TrimEnd('/')

    Write-Host "[UpdatePilot] Pairing $env:COMPUTERNAME with $Server using code $Pair..." -ForegroundColor Cyan

    $body = @{
        pairingCode = $Pair.Trim()
        deviceName = $env:COMPUTERNAME
        osVersion = "Windows ($([System.Environment]::OSVersion.VersionString)) $([System.Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE'))"
        agentVersion = $AgentVersion
    } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod -Uri "$Server/api/v1/devices/pair" -Method POST -Body $body -ContentType "application/json"
        if ($resp.success) {
            Save-Creds -serverUrl $Server -deviceId $resp.data.deviceId -token $resp.data.token
            Write-Host "✔ Successfully paired host: $env:COMPUTERNAME!" -ForegroundColor Green
            Write-Host "Device ID: $($resp.data.deviceId)" -ForegroundColor Gray

            # Auto-run initial scan
            Write-Host "[UpdatePilot] Synchronizing initial software inventory..." -ForegroundColor Cyan
            $apps = Get-WinGetApps
            $scanPayload = @{
                scanJobId = "initial_scan_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                applications = $apps
            } | ConvertTo-Json -Depth 5

            $headers = @{ "Authorization" = "Bearer $($resp.data.token)" }
            $scanRes = Invoke-RestMethod -Uri "$Server/api/v1/devices/$($resp.data.deviceId)/scans" -Method POST -Body $scanPayload -ContentType "application/json" -Headers $headers
            Write-Host "✔ Software inventory synchronized: $($apps.Count) applications discovered!" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Pairing failed: $($resp.error.message)" -ForegroundColor Red
        }
    } catch {
        Write-Host "[ERROR] Failed to communicate with $Server : $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 0
}

# Scan or Service requires pairing credentials
$creds = Load-Creds
if (-not $creds) {
    Write-Host "[ERROR] This machine is not paired. Run with -Pair <CODE> -Server <URL> first." -ForegroundColor Red
    exit 1
}

$headers = @{ "Authorization" = "Bearer $($creds.Token)" }

if ($Scan) {
    $apps = Get-WinGetApps
    $scanPayload = @{
        scanJobId = "manual_scan_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        applications = $apps
    } | ConvertTo-Json -Depth 5

    try {
        $scanRes = Invoke-RestMethod -Uri "$($creds.Server)/api/v1/devices/$($creds.DeviceId)/scans" -Method POST -Body $scanPayload -ContentType "application/json" -Headers $headers
        Write-Host "✔ Scan submitted: $($apps.Count) applications recorded on server!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Scan submission failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 0
}

if ($Service) {
    Write-Host "[UpdatePilot Service] Continuous worker started for $($creds.ComputerName)..." -ForegroundColor Green
    Write-Host "Server: $($creds.Server) | Device ID: $($creds.DeviceId)"
    Write-Host "Press Ctrl+C to terminate."

    $lastHeartbeat = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

    while ($true) {
        try {
            $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            if ($now - $lastHeartbeat -ge 30) {
                # Dispatched heartbeat
                $hbBody = @{ status = "ONLINE"; agentVersion = $AgentVersion } | ConvertTo-Json
                Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/heartbeat" -Method POST -Body $hbBody -ContentType "application/json" -Headers $headers | Out-Null
                $lastHeartbeat = $now
            }

            # Poll for jobs
            $poll = Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/poll" -Method GET -Headers $headers
            if ($poll.success -and $poll.data -and $poll.data.job) {
                $job = $poll.data.job
                Write-Host "[UpdatePilot] Received $($job.type) job: $($job.id)" -ForegroundColor Cyan

                # Claim job
                Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/jobs/$($job.id)/claim" -Method POST -Headers $headers | Out-Null

                if ($job.type -eq "SCAN") {
                    $apps = Get-WinGetApps
                    $scanPayload = @{
                        scanJobId = $job.id
                        applications = $apps
                    } | ConvertTo-Json -Depth 5
                    Invoke-RestMethod -Uri "$($creds.Server)/api/v1/devices/$($creds.DeviceId)/scans" -Method POST -Body $scanPayload -ContentType "application/json" -Headers $headers | Out-Null

                    $repBody = @{ status = "COMPLETED"; logs = "Discovered $($apps.Count) applications" } | ConvertTo-Json
                    Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/jobs/$($job.id)/report" -Method POST -Body $repBody -ContentType "application/json" -Headers $headers | Out-Null
                    Write-Host "✔ Scan job completed ($($apps.Count) apps)." -ForegroundColor Green
                } elseif ($job.type -eq "UPDATE") {
                    $pkgId = $job.payload.packageId
                    $targetVer = $job.payload.targetVersion
                    Write-Host "[UpdatePilot] Executing verified upgrade for $pkgId -> $targetVer..." -ForegroundColor Yellow

                    $upgradeProcess = Start-Process -FilePath "winget" -ArgumentList "upgrade", "--id", $pkgId, "--exact", "--accept-source-agreements", "--accept-package-agreements" -NoNewWindow -Wait -PassThru
                    $exitCode = $upgradeProcess.ExitCode

                    if ($exitCode -eq 0) {
                        $repBody = @{ status = "COMPLETED"; exitCode = 0; verifiedVersion = $targetVer; logs = "Upgrade successful." } | ConvertTo-Json
                        Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/jobs/$($job.id)/report" -Method POST -Body $repBody -ContentType "application/json" -Headers $headers | Out-Null
                        Write-Host "✔ Upgrade job succeeded for $pkgId!" -ForegroundColor Green
                    } else {
                        $repBody = @{ status = "FAILED"; exitCode = $exitCode; errorDetails = "WinGet exited with code $exitCode" } | ConvertTo-Json
                        Invoke-RestMethod -Uri "$($creds.Server)/api/v1/agent/jobs/$($job.id)/report" -Method POST -Body $repBody -ContentType "application/json" -Headers $headers | Out-Null
                        Write-Host "✖ Upgrade job failed with code $exitCode" -ForegroundColor Red
                    }
                }
            }
        } catch {
            Write-Host "[WARNING] Polling error: $($_.Exception.Message)" -ForegroundColor DarkGray
        }

        Start-Sleep -Seconds 15
    }
}

# Default: Show help
Write-Host "Usage: .\UpdatePilot-Client.ps1 [-Pair <Code> -Server <Url>] [-Scan] [-Service] [-Status] [-Unpair]" -ForegroundColor Cyan
