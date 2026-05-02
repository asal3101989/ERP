@echo off
title ConstructERP + TQS Bill Tracker

echo ================================================
echo  ConstructERP India Pro v3.0  +  TQS Bill Tracker
echo ================================================
echo.

REM --- Start TQS Bill Tracker on port 3001 ---
echo [1/3] Starting TQS Bill Tracker (port 3001)...
start "TQS Bill Tracker" cmd /k "cd /d E:\projects\constructio -ERP\construct-erp\app$\final01042026 && node server.js"
timeout /t 2 /nobreak >nul

REM --- Start ConstructERP Backend on port 5000 ---
echo [2/3] Starting ConstructERP Backend (port 5000)...
start "ConstructERP Backend" cmd /k "cd /d E:\projects\constructio -ERP\construct-erp\backend && npm run dev"
timeout /t 2 /nobreak >nul

REM --- Start ConstructERP Frontend on port 3000 ---
echo [3/3] Starting ConstructERP Frontend (port 3000)...
start "ConstructERP Frontend" cmd /k "cd /d E:\projects\constructio -ERP\construct-erp\frontend && npm start"

echo.
echo ================================================
echo  All servers starting...
echo.
echo  ConstructERP   : http://localhost:3000
echo  Backend API    : http://localhost:5000
echo  TQS Tracker    : http://localhost:3001
echo.
echo  Bills module inside ConstructERP -> /bills
echo ================================================
pause
