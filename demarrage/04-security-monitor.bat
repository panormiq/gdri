@echo off
title Security Monitor
echo ========================================
echo   Security Monitor
echo ========================================
echo.

cd /d "%~dp0.."

if not exist "backend\security-monitor.js" (
  echo [ERREUR] backend\security-monitor.js introuvable
  echo Chemin: %CD%
  pause
  exit /b 1
)

echo Chemin: %CD%
echo Surveillance des logs Apache...
echo Ctrl+C pour arreter
echo.

node backend\security-monitor.js
pause
