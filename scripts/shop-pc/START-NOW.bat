@echo off
title Uma Traders Print Bridge
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
pause
