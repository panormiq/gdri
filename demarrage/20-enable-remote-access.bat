@echo off
title GDRI - Activer SSH (derriere VPN local) — Admin requis
echo.
echo  Active OpenSSH pour acces via ton VPN local (SoftEther / WireGuard).
echo  N installe PAS le VPN — voir REMOTE-ACCESS.md
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0Enable-RemoteAccess.ps1\"'"
echo.
echo  Une fenetre Admin s est ouverte.
pause
