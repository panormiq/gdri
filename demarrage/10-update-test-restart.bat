@echo off
title GDRI - Pull TEST + restart backend
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-From-Git.ps1" -Target Test -RestartBackend %*
pause
