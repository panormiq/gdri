@echo off
title Demarrage stack GDRI (sans test)
echo ========================================
echo   Demarrage stack GDRI
echo   (backend test NON inclus - manuel)
echo ========================================
echo.

set "DIR=%~dp0"

echo [1/4] GDRI Backend PROD (3000)...
start "GDRI Backend PROD - 3000" cmd /k "%DIR%01-backend-prod.bat"
timeout /t 2 /nobreak >nul

echo [2/4] BackendIA (8000)...
start "BackendIA - 8000" cmd /k "%DIR%03-backend-ia.bat"
timeout /t 2 /nobreak >nul

echo [3/4] Security Monitor...
start "Security Monitor" cmd /k "%DIR%04-security-monitor.bat"
timeout /t 2 /nobreak >nul

echo [4/4] lostingame (5001)...
start "lostingame - 5001" cmd /k "%DIR%05-lostingame.bat"

echo.
echo ========================================
echo   Fenetres ouvertes:
echo     - GDRI Backend PROD (:3000)
echo     - BackendIA (:8000)
echo     - Security Monitor
echo     - lostingame (:5001)
echo.
echo   Backend TEST: lancer a part
echo     02-backend-test.bat
echo     02-backend-test-dev.bat
echo ========================================
echo.
pause
