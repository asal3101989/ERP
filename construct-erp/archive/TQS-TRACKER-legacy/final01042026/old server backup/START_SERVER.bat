@echo off
title TQS ERP Server (PO + WO)
echo ==========================================
echo   TQS ERP - Merged Tracker Server
echo   Port 3000 - Single DB: tqs_erp.db
echo ==========================================
echo.
echo Current folder: %CD%
echo.

:: Check if folder path contains spaces or protected paths that cause EPERM
echo %CD% | findstr /i "\\new\\" >nul
if %errorlevel%==0 (
  echo *** WARNING: Your folder path contains \new\ ***
  echo *** This may cause "EPERM" database errors.  ***
  echo *** Please move tqs-merged to C:\TQS-Server\ ***
  echo.
  pause
)

echo %CD% | findstr /i "Downloads Desktop OneDrive" >nul
if %errorlevel%==0 (
  echo *** WARNING: Folder is in a protected location ***
  echo *** EPERM errors may occur.                   ***
  echo *** Recommended: Move to C:\TQS-Server\       ***
  echo.
)

node server.js
pause
