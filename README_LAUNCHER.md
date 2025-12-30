# Quick Launcher Feature

This feature allows you to quickly execute PowerShell scripts from anywhere using a global hotkey.

## Setup

1.  **Install AutoHotkey**: Ensure AutoHotkey is installed on your system.
2.  **Run the AHK Script**:
    *   Navigate to the `user_data` folder.
    *   Double-click `quick_launcher.ahk` to run it.
    *   (Optional) Add this script to your Windows Startup folder to have it always available.

## Usage

1.  **Trigger**: Press `Ctrl + F4` (or the hotkey defined in `quick_launcher.ahk`).
2.  **Select**: The PowerShell Manager window will appear with a search bar.
3.  **Search**: Type to filter your available scripts.
4.  **Execute**: Select a script using Up/Down arrows and press `Enter`.
5.  **Focus Restore**: The script will execute in a new window, but focus will automatically return to your previous window (e.g., the editor or browser you were working in).

## Customization

*   **Hotkey**: Edit `user_data/quick_launcher.ahk` to change the `^F4` (Ctrl+F4) hotkey.
*   **Window Title**: If the launcher doesn't appear, ensure your browser window title contains "React App" or "PowerShell Manager". You can adjust this in the AHK script.
