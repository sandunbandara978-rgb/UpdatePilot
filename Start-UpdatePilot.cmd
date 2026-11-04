@echo off
title UpdatePilot — Software Update Intelligence Platform
cd /d "%~dp0"

echo =======================================================================
echo   UpdatePilot — Software Update Intelligence Platform (v1.0.0)
echo =======================================================================
echo.
echo [1/2] Verifying runtime environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js was not found in PATH.
  echo Please install Node.js (v18+) to run the central web dashboard.
  echo Note: Client workstations only need UpdatePilot-Agent-Setup-1.0.0-x64.exe
  echo       which bundles its own private Node.js runtime and requires no setup.
  echo.
  pause
  exit /b 1
)

echo [2/2] Launching Web Dashboard on http://localhost:3000...
start "" "http://localhost:3000"

npm run dev

