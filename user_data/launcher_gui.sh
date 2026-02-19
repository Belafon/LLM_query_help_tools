#!/bin/bash
# Linux Launcher GUI for PowerShell Manager
# Uses rofi, dmenu, or zenity as GUI (whichever is available)
#
# To set up a global hotkey:
#   - GNOME: Settings > Keyboard > Custom Shortcuts > Add: /path/to/launcher_gui.sh --show
#   - KDE: System Settings > Shortcuts > Custom Shortcuts > Add: /path/to/launcher_gui.sh --show
#   - i3/sway: Add to config: bindsym $mod+F4 exec /path/to/launcher_gui.sh --show
#   - xbindkeys: Add to ~/.xbindkeysrc: "/path/to/launcher_gui.sh --show" Control + F4

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_URL="http://localhost:3001"
USAGE_LOG="$SCRIPT_DIR/usage.log"

# Detect available GUI tool
detect_gui_tool() {
    if command -v rofi &> /dev/null; then
        echo "rofi"
    elif command -v dmenu &> /dev/null; then
        echo "dmenu"
    elif command -v zenity &> /dev/null; then
        echo "zenity"
    elif command -v fzf &> /dev/null && [ -t 0 ]; then
        echo "fzf"
    else
        echo "none"
    fi
}

# Fetch scripts from workspace
fetch_scripts() {
    cd "$SCRIPT_DIR"
    node fetch_scripts.js 2>/dev/null | grep -v "^---" | grep -v "^$"
}

# Show launcher GUI and get selection
show_launcher() {
    local gui_tool=$(detect_gui_tool)
    local scripts=$(fetch_scripts)

    if [ -z "$scripts" ]; then
        notify-send "PowerShell Launcher" "No scripts found" 2>/dev/null || echo "No scripts found"
        return 1
    fi

    # Create a formatted list for display (Name - Description)
    local display_list=""
    local -a script_ids=()
    local -a script_names=()
    local -a script_contents=()

    while IFS='|' read -r id name desc content_base64; do
        if [ -n "$id" ]; then
            script_ids+=("$id")
            script_names+=("$name")
            script_contents+=("$content_base64")
            display_list+="$name - $desc"$'\n'
        fi
    done <<< "$scripts"

    # Remove trailing newline
    display_list="${display_list%$'\n'}"

    local selected=""

    case "$gui_tool" in
        rofi)
            selected=$(echo -e "$display_list" | rofi -dmenu -i -p "PowerShell Script" -theme-str 'window {width: 50%;}')
            ;;
        dmenu)
            selected=$(echo -e "$display_list" | dmenu -i -l 20 -p "Script:")
            ;;
        zenity)
            # Create array for zenity list
            local zenity_list=""
            while IFS='|' read -r id name desc content_base64; do
                if [ -n "$id" ]; then
                    zenity_list+="$name"$'\n'"$desc"$'\n'
                fi
            done <<< "$scripts"
            zenity_list="${zenity_list%$'\n'}"

            selected=$(echo -e "$zenity_list" | zenity --list --title="PowerShell Launcher" \
                --column="Name" --column="Description" --width=600 --height=400 2>/dev/null)
            ;;
        fzf)
            selected=$(echo -e "$display_list" | fzf --prompt="Script> " --height=40%)
            ;;
        none)
            echo "Error: No GUI tool found. Install rofi, dmenu, zenity, or fzf."
            echo "Available scripts:"
            echo "$display_list"
            return 1
            ;;
    esac

    if [ -z "$selected" ]; then
        return 1
    fi

    # Extract script name from selection (before " - ")
    local selected_name="${selected%% - *}"

    # Find matching script and execute
    for i in "${!script_names[@]}"; do
        if [ "${script_names[$i]}" = "$selected_name" ]; then
            execute_script "${script_ids[$i]}" "${script_names[$i]}" "${script_contents[$i]}"
            return 0
        fi
    done

    echo "Script not found: $selected_name"
    return 1
}

# Execute script via backend
execute_script() {
    local script_id="$1"
    local script_name="$2"
    local script_base64="$3"

    # Log usage
    echo "$(date +%Y%m%d%H%M%S)|$script_id" >> "$USAGE_LOG"

    # Send to backend
    local response=$(curl -s -X POST "$BACKEND_URL/api/execute" \
        -H "Content-Type: application/json" \
        -d "{\"scriptName\": \"$script_name\", \"scriptBase64\": \"$script_base64\", \"restoreFocus\": false}")

    if echo "$response" | grep -q '"success":true'; then
        notify-send "PowerShell Launcher" "Started: $script_name" 2>/dev/null || echo "Started: $script_name"
    else
        notify-send "PowerShell Launcher" "Failed to start: $script_name" 2>/dev/null || echo "Failed to start: $script_name"
    fi
}

# Main
case "${1:-}" in
    --show|-s)
        show_launcher
        ;;
    --help|-h)
        echo "PowerShell Launcher for Linux"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  --show, -s    Show the launcher GUI"
        echo "  --help, -h    Show this help message"
        echo ""
        echo "Set up a global hotkey in your desktop environment to run:"
        echo "  $0 --show"
        echo ""
        echo "Supported GUI tools (in order of preference):"
        echo "  - rofi (recommended)"
        echo "  - dmenu"
        echo "  - zenity"
        echo "  - fzf (terminal only)"
        ;;
    *)
        # If no argument, show launcher
        show_launcher
        ;;
esac
