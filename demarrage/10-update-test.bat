@echo off
title GDRI - Pull TEST (gdri-dev / develop)
echo.
echo  ========================================
echo   Mise a jour TEST depuis Git
echo   Dossier: htdocs\gdri-dev
echo   Branche: develop
echo  ========================================
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-From-Git.ps1" -Target Test %*
echo.
pause
