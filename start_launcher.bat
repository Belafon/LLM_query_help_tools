@echo off
echo Starting AutoHotkey Launcher Script...

rem Find AutoHotkey executable (check common locations)
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

if "%AHK_EXE%"=="" (
    echo ERROR: AutoHotkey executable not found.
    echo Please install AutoHotkey v2 or set AUTOHOTKEY_PATH environment variable.
    pause
    exit /b 1
)

echo Found AutoHotkey at: %AHK_EXE%
cd user_data
start "" "%AHK_EXE%" "launcher_gui.ahk"
echo Script started. You should see an H icon in your system tray.
echo Press Ctrl+F4 to test.
pause
