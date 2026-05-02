@echo off
title Fix PostgreSQL - Disable SSL + Reset Password
color 0E

echo =============================================
echo  STEP 1: Disable SSL in postgresql.conf
echo =============================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conf = 'C:\Program Files\PostgreSQL\18\data\postgresql.conf'; $raw = [System.IO.File]::ReadAllText($conf); $raw = $raw -replace 'ssl = on', 'ssl = off'; $raw = $raw -replace \"ssl_cert_file = '[^']*'\", \"#ssl_cert_file = 'server.crt'\"; $raw = $raw -replace \"ssl_key_file = '[^']*'\", \"#ssl_key_file = 'server.key'\"; $utf8 = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText($conf, $raw, $utf8); Write-Host '[OK] SSL disabled in postgresql.conf'"

echo.
echo =============================================
echo  STEP 2: Start PostgreSQL service
echo =============================================
net start postgresql-x64-18
timeout /t 4 /nobreak >nul

sc query postgresql-x64-18 | find "RUNNING" >nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Service still not starting!
    echo Check: C:\Program Files\PostgreSQL\18\data\log\
    pause
    exit /b 1
)

color 0A
echo [OK] PostgreSQL is RUNNING!

echo.
echo =============================================
echo  STEP 3: Reset postgres password
echo =============================================
echo.
set /p NEWPASS=Enter new password for postgres user:

"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD '%NEWPASS%';" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Password reset successfully!
    echo.
    echo Now update your backend\.env with:
    echo   DB_PASSWORD=%NEWPASS%
    echo   LOCAL_SSL=false
) else (
    echo.
    echo [WARN] psql could not connect with current password.
    echo We need to reset via pg_hba.conf method.
    echo See instructions below...
    goto :hba_method
)

echo.
echo =============================================
echo  Done! Run RESTART.bat to start ERP servers.
echo =============================================
pause
exit /b 0

:hba_method
echo.
echo =============================================
echo  PASSWORD RESET via pg_hba.conf
echo =============================================
echo.
echo  1. Open this file as Administrator in Notepad:
echo     C:\Program Files\PostgreSQL\18\data\pg_hba.conf
echo.
echo  2. Find this line near the bottom:
echo     host  all  all  127.0.0.1/32  scram-sha-256
echo.
echo  3. Change 'scram-sha-256' to 'trust':
echo     host  all  all  127.0.0.1/32  trust
echo.
echo  4. Save the file and restart PostgreSQL:
echo     net stop postgresql-x64-18
echo     net start postgresql-x64-18
echo.
echo  5. Run this command (no password needed now):
echo     "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD 'YourNewPassword';"
echo.
echo  6. Change pg_hba.conf back to 'scram-sha-256' and restart again.
echo.
pause
