@echo off
title Restart PostgreSQL with SSL
color 0E

echo =========================================
echo  Restarting PostgreSQL 18 with SSL
echo  Run this as ADMINISTRATOR
echo =========================================
echo.

REM Set permissions on server.key (PostgreSQL requires restricted access)
echo Setting permissions on server.key...
icacls "C:\Program Files\PostgreSQL\18\data\server.key" /inheritance:r /grant:r "NT AUTHORITY\NetworkService:(R)" /grant:r "BUILTIN\Administrators:(F)" /grant:r "NT AUTHORITY\SYSTEM:(F)" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Permissions set on server.key
) else (
    echo [WARN] Permission set may have failed - continuing anyway
)

REM Stop the service
echo.
echo Stopping postgresql-x64-18...
net stop postgresql-x64-18
timeout /t 3 /nobreak >nul

REM Start the service
echo.
echo Starting postgresql-x64-18...
net start postgresql-x64-18
timeout /t 3 /nobreak >nul

REM Check service status
sc query postgresql-x64-18 | find "RUNNING" >nul
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo [SUCCESS] PostgreSQL is running with SSL enabled!
    echo.
    echo You can now connect with SSL. Test with:
    echo   psql -h localhost -U postgres -c "SHOW ssl;"
) else (
    color 0C
    echo.
    echo [ERROR] PostgreSQL failed to start!
    echo Check Windows Event Viewer ^> Application logs for PostgreSQL errors.
    echo.
    echo Common fix: Check that server.key has correct permissions.
)

echo.
pause
