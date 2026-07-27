@echo off
title GDRI Backend PROD - Port 3000
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\backend\Start-Backend.ps1" -Mode Prod
pause
