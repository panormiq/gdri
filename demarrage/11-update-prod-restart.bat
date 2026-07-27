@echo off
title GDRI - Update PROD + restart backend
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-From-Git.ps1" -Target Prod -RestartBackend %*
pause
