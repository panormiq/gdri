@echo off
REM Script de démarrage pour tous les backends
REM Fichier : install/demarrage/start-all-backends.bat

echo ========================================
echo   Demarrage de tous les backends
echo ========================================
echo.

REM Démarrer GDRI Backend dans une nouvelle fenêtre
echo [1/3] Demarrage GDRI Backend (Port 3000)...
start "GDRI Backend - Port 3000" cmd /k "%~dp0start-gdri-backend.bat"

timeout /t 2 /nobreak >nul

REM Démarrer doc_template Backend dans une nouvelle fenêtre
echo [2/3] Demarrage doc_template Backend (Port 5005)...
start "doc_template Backend - Port 5005" cmd /k "%~dp0start-doc-template-backend.bat"

timeout /t 2 /nobreak >nul

REM Démarrer Security Monitor dans une nouvelle fenêtre
echo [3/3] Demarrage Security Monitor...
start "Security Monitor" cmd /k "%~dp0start-security-monitor.bat"

echo.
echo ========================================
echo   Tous les services sont demarres
echo ========================================
echo.
echo Les fenetres suivantes ont ete ouvertes:
echo   - GDRI Backend (Port 3000)
echo   - doc_template Backend (Port 5005)
echo   - Security Monitor
echo.
echo Fermez les fenetres individuellement pour arreter chaque service.
echo.
pause
