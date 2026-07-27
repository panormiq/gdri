@echo off
title GDRI Backend TEST DEV - Port 3001
echo.
echo  [MANUEL] Backend test + mode Dev (nodemon si dispo)
echo  URL: https://test.gdri.fr
echo.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\backend\Start-Backend.ps1" -Mode Test -Dev
pause
