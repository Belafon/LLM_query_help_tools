#Requires AutoHotkey v2.0
#SingleInstance Force

SetWorkingDir(A_ScriptDir)

; Configuration
BackendUrl := "http://localhost:3456"

; Global Variables
Scripts := []
myGui := ""
searchCtrl := ""
lvCtrl := ""
isVisible := false

BuildGui()

BuildGui() {
    global myGui, searchCtrl, lvCtrl

    myGui := Gui("+AlwaysOnTop +ToolWindow -Caption +Border")
    myGui.BackColor := "1e1e1e"
    myGui.SetFont("s12 cWhite", "Segoe UI")
    myGui.MarginX := 0
    myGui.MarginY := 0

    searchCtrl := myGui.Add("Edit", "vSearchTerm w600 Background252526")
    searchCtrl.OnEvent("Change", OnSearch)

    lvCtrl := myGui.Add("ListView", "vScriptList w600 h400 -Hdr -Multi Background252526", ["Name", "Description", "ID"])
    lvCtrl.ModifyCol(1, 200)
    lvCtrl.ModifyCol(2, 380)
    lvCtrl.ModifyCol(3, 0)
    lvCtrl.OnEvent("DoubleClick", OnDoubleClick)

    myGui.OnEvent("Escape", OnEscape)
}

; Hotkey to toggle launcher (Ctrl+F4)
^F4:: {
    global myGui, searchCtrl, lvCtrl, isVisible, Scripts

    if isVisible {
        myGui.Hide()
        isVisible := false
    } else {
        Scripts := LoadScripts()
        isVisible := true
        myGui.Title := "PowerShell Launcher"
        myGui.Show()
        searchCtrl.Focus()
        searchCtrl.Value := ""
        RefreshList("")

        ; Save active window for focus restore
        try {
            Active_ID := WinGetID("A")
            try FileDelete("last_active_window.txt")
            FileAppend(String(Active_ID), "last_active_window.txt")
        }
    }
}

OnEscape(*) {
    global myGui, isVisible
    myGui.Hide()
    isVisible := false
}

OnSearch(ctrl, *) {
    RefreshList(ctrl.Value)
}

OnDoubleClick(ctrl, row) {
    if row > 0
        ExecuteSelected()
}

RefreshList(searchTerm) {
    global lvCtrl, Scripts

    lvCtrl.Opt("-Redraw")
    lvCtrl.Delete()

    for script in Scripts {
        if (searchTerm = "" || InStr(script.name, searchTerm) || InStr(script.description, searchTerm)) {
            lvCtrl.Add("", script.name, script.description, script.id)
        }
    }

    lvCtrl.Opt("+Redraw")
    if (lvCtrl.GetCount() > 0)
        lvCtrl.Modify(1, "Select Focus")
}

; Hotkeys active only when launcher is visible
#HotIf WinActive("PowerShell Launcher")

Up:: {
    global lvCtrl
    row := lvCtrl.GetNext(0, "Focused")
    if row > 1
        lvCtrl.Modify(row - 1, "Select Focus")
}

Down:: {
    global lvCtrl
    row := lvCtrl.GetNext(0, "Focused")
    if row < lvCtrl.GetCount()
        lvCtrl.Modify(row + 1, "Select Focus")
}

Enter:: {
    ExecuteSelected()
}

#HotIf

ExecuteSelected() {
    global lvCtrl, Scripts, myGui, isVisible

    row := lvCtrl.GetNext(0, "Focused")
    if (row = 0)
        return

    scriptID := lvCtrl.GetText(row, 3)

    ; Find script in array by ID
    foundScript := ""
    for script in Scripts {
        if (script.id = scriptID) {
            foundScript := script
            break
        }
    }

    if (foundScript != "") {
        myGui.Hide()
        isVisible := false
        RunScript(foundScript)
    }
}

LoadScripts() {
    result := []

    ; Run node script and get output
    shell := ComObject("WScript.Shell")
    try {
        exec := shell.Exec("cmd /c node fetch_scripts.js")
        output := exec.StdOut.ReadAll()
    } catch {
        return result
    }

    Loop Parse, output, "`n", "`r" {
        line := A_LoopField
        if (line = "" || line = "---START---" || line = "---END---")
            continue

        parts := StrSplit(line, "|")
        if (parts.Length >= 4) {
            id := parts[1]
            name := parts[2]
            desc := parts[3]
            contentBase64 := parts[4]
            runInBg := (parts.Length >= 5 && parts[5] = "1") ? true : false

            result.Push({id: id, name: name, description: desc, contentBase64: contentBase64, runInBackground: runInBg})
        }
    }

    return result
}

RunScript(scriptObj) {
    global BackendUrl

    ; Log usage
    FileAppend(A_Now . "|" . scriptObj.id . "`n", "usage.log")

    ; Prepare JSON payload
    WebRequest := ComObject("WinHttp.WinHttpRequest.5.1")
    WebRequest.Open("POST", BackendUrl . "/api/execute", false)
    WebRequest.SetRequestHeader("Content-Type", "application/json")

    runInBg := scriptObj.runInBackground ? "true" : "false"
    json := '{"scriptName": "' . EscapeJSON(scriptObj.name) . '", "scriptBase64": "' . scriptObj.contentBase64 . '", "restoreFocus": true, "runInBackground": ' . runInBg . '}'

    try {
        WebRequest.Send(json)
    } catch {
        MsgBox("Failed to send execute request to backend. Is it running?")
    }
}

EscapeJSON(str) {
    str := StrReplace(str, "\", "\\")
    str := StrReplace(str, '"', '\"')
    str := StrReplace(str, "`n", "\n")
    str := StrReplace(str, "`r", "")
    str := StrReplace(str, "`t", "\t")
    return str
}
