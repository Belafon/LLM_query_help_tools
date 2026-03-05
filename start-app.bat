@echo off
echo Starting PowerShell Manager Application...
echo.

echo [1/2] Starting Backend Service...
cd backend
start "Backend" cmd /k "npm start"
cd ..

echo [2/2] Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo [3/3] Starting Quick Launcher...
rem Find AutoHotkey executable
set "AHK_EXE="
if exist "%LOCALAPPDATA%\Programs\AutoHotkey\v2\AutoHotkey64.exe" (
    set "AHK_EXE=%LOCALAPPDATA%\Programs\AutoHotkey\v2\AutoHotkey64.exe"
) else if exist "%LOCALAPPDATA%\Programs\AutoHotkey\v2\AutoHotkey32.exe" (
    set "AHK_EXE=%LOCALAPPDATA%\Programs\AutoHotkey\v2\AutoHotkey32.exe"
) else if exist "%ProgramFiles%\AutoHotkey\v2\AutoHotkey64.exe" (
    set "AHK_EXE=%ProgramFiles%\AutoHotkey\v2\AutoHotkey64.exe"
) else if exist "%ProgramFiles%\AutoHotkey\v2\AutoHotkey32.exe" (
    set "AHK_EXE=%ProgramFiles%\AutoHotkey\v2\AutoHotkey32.exe"
) else if exist "%ProgramFiles%\AutoHotkey\AutoHotkey.exe" (
    set "AHK_EXE=%ProgramFiles%\AutoHotkey\AutoHotkey.exe"
)
if not "%AHK_EXE%"=="" (
    cd user_data
    start "" "%AHK_EXE%" "launcher_gui.ahk"
    cd ..
    echo Launcher started with: %AHK_EXE%
) else (
    echo WARNING: AutoHotkey not found. Ctrl+F4 launcher will not be available.
)

echo Starting Frontend Application...
npm start

echo.
echo Both services should now be running:
echo - Backend: http://localhost:3001
echo - Frontend: http://localhost:3000
echo.
pause