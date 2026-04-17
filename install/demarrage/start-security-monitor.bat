@echo off
REM Script de démarrage pour le Security Monitor
REM Fichier : install/demarrage/start-security-monitor.bat

echo ========================================
echo   Security Monitor
echo ========================================
echo.

cd /d "%~dp0..\.."

if not exist "backend\security-monitor.js" (
    echo [ERREUR] security-monitor.js non trouve dans le dossier backend
    echo Chemin actuel: %CD%
    pause
    exit /b 1
)

echo Chemin: %CD%
echo.
echo Demarrage du Security Monitor...
echo Le monitoring va analyser les logs Apache toutes les minutes
echo Appuyez sur Ctrl+C pour arreter
echo.

node backend\security-monitor.js

pause
