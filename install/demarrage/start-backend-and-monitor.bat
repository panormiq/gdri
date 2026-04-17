@echo off
REM Script de demarrage pour le backend GDRI + Security Monitor
REM Fichier : install/demarrage/start-backend-and-monitor.bat

echo ========================================
echo   Demarrage Backend + Security Monitor
echo ========================================
echo.

REM Demarrer GDRI Backend dans une nouvelle fenetre
echo [1/2] Demarrage GDRI Backend (Port 3000)...
start "GDRI Backend - Port 3000" cmd /k "%~dp0start-gdri-backend.bat"

timeout /t 2 /nobreak >nul

REM Demarrer Security Monitor dans une nouvelle fenetre
echo [2/2] Demarrage Security Monitor...
start "Security Monitor" cmd /k "%~dp0start-security-monitor.bat"

echo.
echo ========================================
echo   Services demarres
echo ========================================
echo.
echo Les fenetres suivantes ont ete ouvertes:
echo   - GDRI Backend (Port 3000)
echo   - Security Monitor
echo.
echo Fermez les fenetres individuellement pour arreter chaque service.
echo.
pause
