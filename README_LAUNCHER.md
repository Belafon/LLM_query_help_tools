# Quick Launcher Feature

This feature allows you to quickly execute PowerShell scripts from anywhere using a global hotkey.

## Platform Support

The launcher works on both **Windows** and **Linux**:

| Feature | Windows | Linux |
|---------|---------|-------|
| Global Hotkey | AutoHotkey (Ctrl+F4) | Desktop environment shortcut |
| Script Execution | PowerShell | PowerShell Core (pwsh) or Bash fallback |
| GUI Launcher | Native AHK GUI | rofi/dmenu/zenity/fzf |

---

## Windows Setup

1.  **Install AutoHotkey**: Ensure AutoHotkey is installed on your system.
2.  **Run the AHK Script**:
    *   Navigate to the `user_data` folder.
    *   Double-click `launcher_gui.ahk` to run it.
    *   (Optional) Add this script to your Windows Startup folder to have it always available.

### Windows Usage

1.  **Trigger**: Press `Ctrl + F4` (or the hotkey defined in `launcher_gui.ahk`).
2.  **Select**: A dark-themed launcher window will appear with a search bar.
3.  **Search**: Type to filter your available scripts.
4.  **Execute**: Select a script using Up/Down arrows and press `Enter`.
5.  **Focus Restore**: The script will execute in a new window, but focus will automatically return to your previous window.

---

## Linux Setup

### Prerequisites

1.  **Install PowerShell Core** (recommended):
    ```bash
    # Ubuntu/Debian
    sudo apt-get install -y powershell

    # Fedora
    sudo dnf install -y powershell

    # Arch Linux
    yay -S powershell-bin
    ```

    Without PowerShell Core, scripts will be auto-converted to Bash (basic support only).

2.  **Install a GUI tool** (at least one):
    ```bash
    # rofi (recommended - best experience)
    sudo apt install rofi

    # dmenu (lightweight alternative)
    sudo apt install dmenu

    # zenity (GNOME-native)
    sudo apt install zenity

    # fzf (terminal-only)
    sudo apt install fzf
    ```

### Linux Usage

#### Option 1: Set Up Global Hotkey (Recommended)

Configure a keyboard shortcut in your desktop environment:

**GNOME:**
1. Settings → Keyboard → Custom Shortcuts → Add
2. Name: `PowerShell Launcher`
3. Command: `/path/to/LLM_query_help_tools/user_data/launcher_gui.sh --show`
4. Shortcut: `Ctrl+F4`

**KDE:**
1. System Settings → Shortcuts → Custom Shortcuts → Add
2. Trigger: `Ctrl+F4`
3. Action: `/path/to/LLM_query_help_tools/user_data/launcher_gui.sh --show`

**i3/sway:**
Add to config:
```
bindsym $mod+F4 exec /path/to/LLM_query_help_tools/user_data/launcher_gui.sh --show
```

**xbindkeys:**
Add to `~/.xbindkeysrc`:
```
"/path/to/LLM_query_help_tools/user_data/launcher_gui.sh --show"
    Control + F4
```

#### Option 2: Manual Execution

```bash
# From the project directory
./user_data/launcher_gui.sh --show

# Or via npm
npm run launcher:linux
```

### Linux Launcher Features

- **rofi**: Full search with fuzzy matching, dark theme
- **dmenu**: Lightweight, keyboard-driven selection
- **zenity**: GTK dialog with list view
- **fzf**: Terminal-based fuzzy finder

---

## Starting the Application

### Windows

```batch
# Full application (backend + frontend + launcher)
start-app.bat

# Or via npm
npm run dev:launcher
```

### Linux

```bash
# Full application (backend + frontend)
./start-app.sh

# Or via npm
npm run dev

# Then separately set up the global hotkey as described above
```

---

## Script Execution

### On Windows
- Scripts run in PowerShell (`powershell.exe`)
- Opens in a new console window
- Supports focus restoration to previous window

### On Linux
- **With PowerShell Core**: Scripts run in `pwsh` in a new terminal window
- **Without PowerShell Core**: Scripts are auto-converted to Bash (basic support)
- Supported terminal emulators: gnome-terminal, konsole, xfce4-terminal, xterm, mate-terminal, tilix, alacritty, kitty

---

## Customization

### Windows
*   **Hotkey**: Edit `user_data/launcher_gui.ahk` to change the `^F4` (Ctrl+F4) hotkey.

### Linux
*   **GUI Tool**: The launcher auto-detects available tools in order: rofi → dmenu → zenity → fzf
*   **Hotkey**: Configure in your desktop environment's settings
