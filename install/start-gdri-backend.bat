@echo off
REM Script de démarrage pour le backend GDRI (Port 3000)
REM Fichier : install/start-gdri-backend.bat

echo ========================================
echo   GDRI Backend - Port 3000
echo ========================================
echo.

cd /d "%~dp0.."
cd backend

if not exist "server.js" (
    echo [ERREUR] server.js non trouve dans le dossier backend
    echo Chemin actuel: %CD%
    pause
    exit /b 1
)

echo Chemin: %CD%
echo.
echo Demarrage du serveur...
echo Appuyez sur Ctrl+C pour arreter
echo.

node server.js

pause
