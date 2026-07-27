@echo off
title GDRI - Pull TEST (branche develop)
echo.
echo  ========================================
echo   Mise a jour TEST depuis Git
echo   Branche: develop
echo  ========================================
echo.
echo  ATTENTION: meme dossier code que la prod.
echo  www servira aussi develop apres ce pull.
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-From-Git.ps1" -Target Test %*
echo.
pause
