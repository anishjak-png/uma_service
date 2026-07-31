@echo off
title Uma Traders Print Bridge - Uninstall auto-start
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
