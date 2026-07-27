@echo off
title BackendIA - Port 8000
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\backendIA\Start-BackendIA.ps1"
pause
