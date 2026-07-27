@echo off
title GDRI Backend TEST - Port 3001
echo.
echo  [MANUEL] Backend test - ne pas lancer avec 00-tout.bat
echo  URL: https://test.gdri.fr
echo.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\backend\Start-Backend.ps1" -Mode Test
pause
