#NoEnv
#SingleInstance Force
SetWorkingDir %A_ScriptDir%

; Configuration
BackendUrl := "http://localhost:3456"
SettingsFile := "settings.json"
WorkspacesDir := "workspaces"

; Global Variables
Scripts := {}
FilteredScripts := []
CurrentSelection := 1

; GUI Setup
Gui, Font, s12 cWhite, Segoe UI
; Set Window Color (1e1e1e) and Control Color (252526)
; This ensures Edit and ListView controls get the dark background
Gui, Color, 1e1e1e, 252526

; Search Box: Inherits dark background and white text
Gui, Add, Edit, vSearchTerm gOnSearch w600 -E0x200, 

; List View: Inherits dark background and white text
Gui, Add, ListView, vScriptList gOnScriptSelect w600 h400 -Hdr -Multi -E0x200, Name|Description|ID

; Set Column Widths
LV_ModifyCol(1, 200) ; Name column - 200px
LV_ModifyCol(2, 380) ; Description column - remaining width
LV_ModifyCol(3, 0)   ; ID column - 0px (Hidden)

Gui, +AlwaysOnTop +ToolWindow -Caption +Border

; Hotkey to toggle launcher (Ctrl+F4)
^F4::
    IfWinExist, PowerShell Launcher
    {
        Gui, Hide
    }
    else
    {
        LoadScripts()
        Gui, Show, , PowerShell Launcher
        GuiControl, Focus, SearchTerm
        GuiControl, , SearchTerm, 
        GoSub, OnSearch ; Refresh list
        
        ; Save active window for focus restore
        WinGet, Active_ID, ID, A
        FileDelete, last_active_window.txt
        FileAppend, %Active_ID%, last_active_window.txt
    }
return

GuiEscape:
    Gui, Hide
return

OnSearch:
    Gui, Submit, NoHide
    GuiControl, -Redraw, ScriptList
    LV_Delete()
    
    ; Iterate array
    Loop % Scripts.MaxIndex()
    {
        script := Scripts[A_Index]
        If (SearchTerm = "" || InStr(script.name, SearchTerm) || InStr(script.description, SearchTerm))
        {
            LV_Add("", script.name, script.description, script.id)
        }
    }
    
    GuiControl, +Redraw, ScriptList
    if (LV_GetCount() > 0)
        LV_Modify(1, "Select Focus")
return

OnScriptSelect:
    if (A_GuiEvent = "DoubleClick")
    {
        GoSub, ExecuteSelected
    }
return

#IfWinActive PowerShell Launcher
Up::
    LV_Modify(LV_GetNext(0, "Focused") - 1, "Select Focus")
return

Down::
    LV_Modify(LV_GetNext(0, "Focused") + 1, "Select Focus")
return

Enter::
    GoSub, ExecuteSelected
return
#IfWinActive

ExecuteSelected:
    RowNumber := LV_GetNext(0, "Focused")
    if (RowNumber = 0)
        return
        
    LV_GetText(ScriptID, RowNumber, 3)
    
    ; Find script in array by ID
    FoundScript := ""
    Loop % Scripts.MaxIndex()
    {
        if (Scripts[A_Index].id = ScriptID)
        {
            FoundScript := Scripts[A_Index]
            break
        }
    }
    
    if (FoundScript)
    {
        Gui, Hide
        RunScript(FoundScript)
    }
return

LoadScripts() {
    global Scripts
    Scripts := [] ; Changed to Array to preserve order
    
    ; Run node script and get output
    ; We use ComObj to run command and capture stdout
    Shell := ComObjCreate("WScript.Shell")
    ; Run node fetch_scripts.js
    ; We assume node is in PATH
    Exec := Shell.Exec("cmd /c node fetch_scripts.js")
    
    ; Read all output
    Output := Exec.StdOut.ReadAll()
    
    Loop, Parse, Output, `n, `r
    {
        Line := A_LoopField
        if (Line = "" || Line = "---START---" || Line = "---END---")
            continue

        parts := StrSplit(Line, "|")
        if (parts.MaxIndex() >= 4)
        {
            id := parts[1]
            name := parts[2]
            desc := parts[3]
            contentBase64 := parts[4]
            runInBackground := (parts.MaxIndex() >= 5 && parts[5] = "1") ? true : false

            ; Push to array instead of map
            Scripts.Push({id: id, name: name, description: desc, contentBase64: contentBase64, runInBackground: runInBackground})
        }
    }
}

RunScript(scriptObj) {
    global BackendUrl

    ; Log usage
    FileAppend, % A_Now . "|" . scriptObj.id . "`n", usage.log

    ; Prepare JSON payload
    ; We send scriptBase64 instead of script content to avoid escaping issues

    WebRequest := ComObjCreate("WinHttp.WinHttpRequest.5.1")
    WebRequest.Open("POST", BackendUrl . "/api/execute", false)
    WebRequest.SetRequestHeader("Content-Type", "application/json")

    runInBg := scriptObj.runInBackground ? "true" : "false"
    json := "{""scriptName"": """ . EscapeJSON(scriptObj.name) . """, ""scriptBase64"": """ . scriptObj.contentBase64 . """, ""restoreFocus"": true, ""runInBackground"": " . runInBg . "}"

    try {
        WebRequest.Send(json)
    } catch e {
        MsgBox, Failed to send execute request to backend. Is it running?
    }
}

EscapeJSON(str) {
    str := StrReplace(str, "\", "\\")
    str := StrReplace(str, """", "\""")
    str := StrReplace(str, "`n", "\n")
    str := StrReplace(str, "`r", "")
    str := StrReplace(str, "`t", "\t")
    return str
}
