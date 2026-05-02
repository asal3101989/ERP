@echo off
title Restarting ConstructERP
color 0C
echo Stopping all Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Starting servers...
color 0A
node "%~dp0start-all.js"
pause
