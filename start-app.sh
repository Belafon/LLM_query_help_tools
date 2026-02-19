#!/bin/bash
echo "Starting PowerShell Manager Application..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/3] Starting Backend Service..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo "[2/3] Waiting 3 seconds for backend to start..."
sleep 3

echo "[3/3] Starting Quick Launcher..."
cd user_data
if [ -f "launcher_gui.sh" ]; then
    ./launcher_gui.sh &
    echo "Launcher started. Press Ctrl+F4 equivalent hotkey (configure in your desktop environment)."
else
    echo "Note: Linux launcher (launcher_gui.sh) not found. You can still use the web interface."
fi
cd ..

echo ""
echo "Starting Frontend Application..."
npm start

echo ""
echo "Both services should now be running:"
echo "- Backend: http://localhost:3001"
echo "- Frontend: http://localhost:3000"
echo ""
