@echo off
title GDRI - Update PROD (branche master apres merge)
echo.
echo  ========================================
echo   Mise a jour PROD depuis Git
echo   Branche: master (apres merge)
echo  ========================================
echo.
echo  A lancer APRES le merge develop -^> master sur GitHub.
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-From-Git.ps1" -Target Prod %*
echo.
pause
