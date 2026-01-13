@echo off
REM Script de démarrage pour le backend doc_template (Port 5005)
REM Fichier : install/start-doc-template-backend.bat

echo ========================================
echo   doc_template Backend - Port 5005
echo ========================================
echo.

set "BACKEND_PATH=C:\xampp\htdocs\continue\doc_template\back"

REM Vérifier si le chemin existe
if not exist "%BACKEND_PATH%" (
    echo [ERREUR] Dossier non trouve: %BACKEND_PATH%
    echo.
    echo Verifiez que le chemin est correct.
    pause
    exit /b 1
)

cd /d "%BACKEND_PATH%"

REM Vérifier si package.json existe (pour npm run dev)
if exist "package.json" (
    echo Chemin: %CD%
    echo.
    echo package.json trouve - Utilisation de: npm run dev
    echo Appuyez sur Ctrl+C pour arreter
    echo.
    npm run dev
) else if exist "server.js" (
    echo Chemin: %CD%
    echo.
    echo server.js trouve - Utilisation de: node server.js
    echo Appuyez sur Ctrl+C pour arreter
    echo.
    node server.js
) else (
    echo [ERREUR] package.json ou server.js non trouve dans:
    echo %CD%
    pause
    exit /b 1
)

pause
