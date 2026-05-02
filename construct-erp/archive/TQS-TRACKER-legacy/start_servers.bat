@echo off
title BCIM Enterprise Servers

echo ===================================================
echo     STARTING BCIM ENTERPRISE APPLICATIONS
echo ===================================================
echo.

echo [1/3] Launching BCIM Hub Portal (Port 3003)...
start "BCIM Hub Portal" cmd /k "node portal_server.js"

echo [2/3] Launching TQS Tracker (Port 3000)...
start "TQS Tracker Backend" cmd /k "cd final01042026 && node server.js"

echo [3/3] Launching BuildPro Procurement (Port 3001)...
start "BuildPro Procurement Backend" cmd /k "cd proc && node server.js"

echo.
echo ===================================================
echo   All 3 Servers successfully launched!
echo   You can safely close this terminal now. 
echo   Please open: http://localhost:3003
echo ===================================================
pause
