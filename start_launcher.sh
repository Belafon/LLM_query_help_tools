#!/bin/bash
echo "Starting Linux Launcher Script..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/user_data"

if [ -f "launcher_gui.sh" ]; then
    ./launcher_gui.sh &
    echo "Script started."
    echo "To trigger the launcher, use your configured hotkey or run: ./user_data/launcher_gui.sh --show"
else
    echo "Error: launcher_gui.sh not found in user_data directory."
    exit 1
fi
