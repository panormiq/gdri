@echo off
title lostingame Backend - Port 5001
echo ========================================
echo   lostingame Backend - Port 5001
echo ========================================
echo.

set "LOST_ROOT=C:\xampp\htdocs\lostingame"
set "LOST_BACKEND=%LOST_ROOT%\backend"

if exist "%LOST_ROOT%\start-backend.ps1" (
  cd /d "%LOST_ROOT%"
  echo Chemin: %CD%
  echo Lancement via start-backend.ps1...
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%LOST_ROOT%\start-backend.ps1"
  pause
  exit /b %ERRORLEVEL%
)

if not exist "%LOST_BACKEND%" (
  echo [ERREUR] Dossier introuvable: %LOST_BACKEND%
  pause
  exit /b 1
)

cd /d "%LOST_BACKEND%"
echo Chemin: %CD%
echo.

if exist "package.json" (
  echo Commande: npm run dev
  npm run dev
) else if exist "server.js" (
  echo Commande: node server.js
  node server.js
) else (
  echo [ERREUR] package.json / server.js introuvable
  pause
  exit /b 1
)

pause
