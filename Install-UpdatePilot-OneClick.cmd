@echo off
setlocal
title UpdatePilot - One-Click Auto Registration
echo ========================================================
echo       UpdatePilot Auto-Registration & Discovery
echo ========================================================
echo.
echo Connecting this computer to UpdatePilot Cloud:
echo https://web-six-omega-as4c1q7v4e.vercel.app
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$Server = 'https://web-six-omega-as4c1q7v4e.vercel.app';" ^
  "Write-Host '[1/4] Connecting to UpdatePilot Cloud API...' -ForegroundColor Cyan;" ^
  "try {" ^
  "  $login = Invoke-RestMethod -Uri \"$Server/api/v1/auth/login\" -Method POST -Body (@{ email = 'admin@updatepilot.local'; password = 'Password123!' } | ConvertTo-Json) -ContentType 'application/json';" ^
  "  $codeRes = Invoke-RestMethod -Uri \"$Server/api/v1/devices/generate-code\" -Method POST -Headers @{ Authorization = \"Bearer $($login.data.token)\" };" ^
  "  $pairCode = $codeRes.data.pairingCode;" ^
  "  Write-Host \"[2/4] Generated One-Time Fleet Code: $pairCode\" -ForegroundColor Green;" ^
  "  $scriptPath = \"$env:TEMP\UpdatePilot-Client.ps1\";" ^
  "  Invoke-WebRequest -Uri \"$Server/api/v1/agent/install\" -OutFile $scriptPath;" ^
  "  Write-Host '[3/4] Registering PC and scanning installed WinGet packages...' -ForegroundColor Cyan;" ^
  "  & $scriptPath -Pair $pairCode -Server $Server -Scan;" ^
  "  Write-Host '[4/4] SUCCESS! This computer is now live on UpdatePilot!' -ForegroundColor Green;" ^
  "} catch {" ^
  "  Write-Host ('[ERROR] Failed: ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "}"

echo.
echo ========================================================
echo Finished! You can now close this window.
echo ========================================================
pause
