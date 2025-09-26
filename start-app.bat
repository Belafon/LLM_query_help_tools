@echo off
echo Starting PowerShell Manager Application...
echo.

echo [1/2] Starting Backend Service...
cd backend
start "Backend" cmd /k "npm start"
cd ..

echo [2/2] Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Application...
npm start

echo.
echo Both services should now be running:
echo - Backend: http://localhost:3001
echo - Frontend: http://localhost:3000
echo.
pause