; Quick Launcher for PowerShell Manager
; Triggers with Ctrl+F4 (Change as needed)

MsgBox, Quick Launcher Script Started! Press Ctrl+F4 to toggle the launcher.

^F4::
    ; Debug message (uncomment if needed)
    ; MsgBox, Ctrl+F4 pressed!
    
    ; Get the HWND of the current active window
    WinGet, Active_ID, ID, A
    
    ; Save it to a file so the backend can read it later
    ; We assume this script is in user_data folder
    FileDelete, %A_ScriptDir%\last_active_window.txt
    FileAppend, %Active_ID%, %A_ScriptDir%\last_active_window.txt
    
    ; Activate the React App window
    ; You might need to adjust the title match mode or the title itself
    SetTitleMatchMode, 2
    
    ; Try to find the window
    IfWinExist, React App
    {
        WinActivate
        ; Wait for window to be active
        WinWaitActive, React App, , 2
        if ErrorLevel
        {
             MsgBox, Found "React App" window but could not activate it.
             return
        }
        
        ; Send the shortcut to open the launcher (Ctrl+Alt+L)
        Send, ^!l
    }
    else
    {
        MsgBox, PowerShell Manager (React App) window not found. Please ensure the app is open in a browser window with "React App" in the title.
    }
return
