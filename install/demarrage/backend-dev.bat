@echo off
REM Lance le backend GDRI en mode developpement (npm run dev)
REM Fichier : install/demarrage/backend-dev.bat

echo ========================================
echo   GDRI Backend - Mode DEV
echo ========================================
echo.

cd /d "%~dp0..\.."
cd backend

if not exist "package.json" (
    echo [ERREUR] package.json non trouve dans le dossier backend
    echo Chemin actuel: %CD%
    pause
    exit /b 1
)

echo Chemin: %CD%
echo.
echo Demarrage avec: npm run dev
echo Appuyez sur Ctrl+C pour arreter
echo.

npm run dev

pause
