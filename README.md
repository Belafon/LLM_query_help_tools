# LLM Query Helper Tools

A cross-platform desktop toolkit for managing scripts, files, secrets, and workflows — built to supercharge your productivity when working with LLMs and automation tasks.

Built with **React** (frontend) and **Node.js / Express + WebSocket** (backend). Works on **Windows**, **Linux**, and **macOS**.

---

## Table of Contents

- [LLM Query Helper Tools](#llm-query-helper-tools)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Install \& Run](#install--run)
    - [Alternative: Start Services Separately](#alternative-start-services-separately)
  - [Features Overview](#features-overview)
    - [📄 File Processor](#-file-processor)
    - [⚡ PowerShell Manager](#-powershell-manager)
    - [⌨️ Hotkey Manager](#️-hotkey-manager)
    - [📁 Workspace Manager](#-workspace-manager)
    - [🔗 Path Manager](#-path-manager)
    - [🔐 Secret Manager](#-secret-manager)
    - [🚀 Quick Launcher](#-quick-launcher)
  - [Path Aliases \& Secrets in Scripts](#path-aliases--secrets-in-scripts)
  - [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Configuration \& Data](#configuration--data)
  - [Available npm Scripts](#available-npm-scripts)
  - [Troubleshooting](#troubleshooting)
  - [License](#license)

---

## Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm**
- *(Optional)* **PowerShell Core** (`pwsh`) — for Linux/macOS script execution
- *(Optional)* **AutoHotkey** — for Windows hotkey scripts

### Install & Run

```bash
# 1. Install dependencies (first time only)
npm install
cd backend && npm install && cd ..

# 2. Start both frontend and backend
npm run dev
```

The app will be available at **http://localhost:3000**. The backend API/WebSocket runs on **http://localhost:3001**.

> Use `Ctrl+C` to stop both services.

### Alternative: Start Services Separately

```bash
# Terminal 1 — Backend
npm run backend

# Terminal 2 — Frontend
npm run frontend
```

---

## Features Overview

The application is organized into six pages accessible from the collapsible sidebar, plus an in-app quick launcher.

### 📄 File Processor

Combine multiple files into a single text output — perfect for pasting code context into LLM prompts.

- **Drag & drop** files and folders directly into the browser (processes recursively)
- **Enter absolute file paths** in a text box (one per line) to read files from anywhere on your system via the backend
- Each file is wrapped with clear `=== FILE START ===` / `=== FILE END ===` markers
- **Copy to clipboard** or **download** the combined result
- Warnings for files not found or unreadable
- Supports both Windows (`C:\...`) and Unix (`/home/...`) paths

### ⚡ PowerShell Manager

Create, edit, store, and execute PowerShell scripts from a web UI.

- **Script library** — save named scripts organized by workspace
- **Dual-platform support** — write separate Windows (PowerShell) and Linux (pwsh / bash) versions of each script
- **One-click execution** — runs scripts in a new terminal window on your system
- **Path alias & secret substitution** — use `{{ALIAS}}` placeholders in scripts that are resolved at runtime (see [Path Aliases](#path-aliases--secrets-in-scripts))
- **Real-time status** — WebSocket connection shows backend status and execution progress
- **Compact / expanded list view** toggle
- Auto-detects platform and shows the appropriate script variant

### ⌨️ Hotkey Manager

Create and manage persistent hotkey scripts (AutoHotkey on Windows, sxhkd on Linux).

- **Create hotkey scripts** with separate Windows (AHK) and Linux (sxhkd) content
- **Start / Stop** individual hotkey scripts from the UI
- **Auto-start** option — mark scripts to launch automatically
- **Running status tracking** — see which hotkey scripts are currently active
- **Workspace-aware** — hotkey sets can differ per workspace

### 📁 Workspace Manager

Organize all your scripts, paths, and hotkeys into separate workspaces.

- **Create, switch, and delete** workspaces
- **Default workspace** is always available and cannot be deleted
- Switching workspaces reloads all data (scripts, paths, hotkeys) for that context
- Workspace name is shown in the sidebar footer
- All workspace data is stored in `user_data/workspaces/<name>/`

### 🔗 Path Manager

Define reusable path aliases that can be referenced in any script.

- **Add aliases** — give a short name (e.g., `PROJECT_ROOT`) to a long file path
- **Edit or rename** aliases — renaming automatically updates all scripts across all workspaces
- **Delete** aliases you no longer need
- Aliases are stored globally in `user_data/global_paths.json`
- Use them in scripts as `{{PROJECT_ROOT}}` — they are replaced with the actual path at execution time

### 🔐 Secret Manager

Store sensitive values (API keys, tokens, passwords) that can be injected into scripts.

- **Add secret keys** with optional descriptions
- **Set values** — secret values are stored separately in `user_data/secrets/values.json` (outside of version control)
- **Show / hide** values with a toggle for each secret
- **Delete** secrets you no longer need
- Use them in scripts as `{{MY_API_KEY}}` — identical syntax to path aliases, resolved at runtime
- Key names are auto-formatted to `UPPER_SNAKE_CASE`

### 🚀 Quick Launcher

A Spotlight / Alfred-style overlay to search and execute scripts instantly.

**In-app launcher (browser):**
- Press **`Ctrl + Alt + L`** to open the launcher overlay
- Type to fuzzy-search your PowerShell scripts
- Use **Arrow keys** to navigate, **Enter** to execute
- Press **Escape** to close

**System-wide launcher (optional):**
- **Windows:** Run `user_data/launcher_gui.ahk` (requires AutoHotkey) — triggers with `Ctrl+F4`
- **Linux:** Set up `user_data/launcher_gui.sh` as a global keyboard shortcut — works with rofi, dmenu, zenity, or fzf
- See [README_LAUNCHER.md](README_LAUNCHER.md) for detailed setup instructions

---

## Path Aliases & Secrets in Scripts

Both path aliases and secrets use the same `{{PLACEHOLDER}}` syntax inside scripts. When a script is executed, the backend replaces all `{{...}}` placeholders with their actual values before running the script.

**Example script:**
```powershell
cd "{{PROJECT_ROOT}}"
$apiKey = "{{OPENAI_API_KEY}}"
Invoke-RestMethod -Uri "https://api.example.com" -Headers @{ "Authorization" = "Bearer $apiKey" }
```

- `{{PROJECT_ROOT}}` is resolved from **Path Manager**
- `{{OPENAI_API_KEY}}` is resolved from **Secret Manager**

This keeps your scripts portable and your secrets out of script content.

---

## Architecture

```
┌─────────────────────────┐     WebSocket (port 3001)     ┌──────────────────────────┐
│    React Frontend       │◄──────────────────────────────►│   Node.js Backend        │
│    (port 3000)          │     HTTP REST (port 3001)      │   (Express + WS)         │
│                         │◄──────────────────────────────►│                          │
│  - File Processor       │                                │  - Script execution      │
│  - PowerShell Manager   │                                │  - File I/O              │
│  - Hotkey Manager       │                                │  - Workspace management  │
│  - Workspace Manager    │                                │  - Path alias resolution │
│  - Path Manager         │                                │  - Secret management     │
│  - Secret Manager       │                                │  - AHK/sxhkd process mgmt│
│  - Quick Launcher       │                                │  - Platform detection    │
└─────────────────────────┘                                └──────────────────────────┘
                                                                      │
                                                                      ▼
                                                           ┌──────────────────────────┐
                                                           │   user_data/             │
                                                           │   - settings.json        │
                                                           │   - global_paths.json    │
                                                           │   - secret_keys.json     │
                                                           │   - secrets/values.json  │
                                                           │   - workspaces/          │
                                                           │     └─ <name>/           │
                                                           │        └─ scripts.json   │
                                                           └──────────────────────────┘
```

- **Frontend** communicates with the backend via WebSocket for real-time updates and HTTP REST for file reading.
- **Backend** manages all persistent data, script execution, and platform-specific operations.
- **User data** is stored in the `user_data/` directory as JSON files.

---

## Project Structure

```
LLM_query_help_tools/
├── backend/
│   ├── server.js              # Express + WebSocket backend
│   └── package.json
├── src/
│   ├── App.js                 # Main app with router
│   ├── components/
│   │   ├── Sidebar.js         # Collapsible navigation sidebar
│   │   └── Launcher.js        # In-app quick launcher overlay
│   ├── config/
│   │   └── pageRegistry.js    # Central page definitions
│   └── pages/
│       ├── FileProcessor.js   # Drag-drop file combiner
│       ├── PowerShellManager.js
│       ├── HotkeyManager.js
│       ├── WorkspaceManager.js
│       ├── PathManager.js
│       └── SecretManager.js
├── user_data/
│   ├── settings.json          # App settings (current workspace, etc.)
│   ├── global_paths.json      # Path aliases
│   ├── secret_keys.json       # Secret key definitions
│   ├── secrets/
│   │   └── values.json        # Secret values (gitignored)
│   ├── workspaces/
│   │   ├── Default/
│   │   │   └── scripts.json
│   │   └── .../
│   ├── launcher_gui.ahk       # Windows system launcher (AutoHotkey)
│   └── launcher_gui.sh        # Linux system launcher
├── package.json
├── QUICK_START.md
└── README_LAUNCHER.md         # Detailed launcher setup guide
```

---

## Configuration & Data

| File | Purpose |
|------|---------|
| `user_data/settings.json` | Currently active workspace and app preferences |
| `user_data/global_paths.json` | Path alias definitions (used across all workspaces) |
| `user_data/secret_keys.json` | Secret key names and descriptions |
| `user_data/secrets/values.json` | Actual secret values (**do not commit to git**) |
| `user_data/workspaces/<name>/scripts.json` | PowerShell and hotkey scripts for each workspace |

---

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend concurrently |
| `npm run backend` | Start only the backend (port 3001) |
| `npm run frontend` | Start only the React frontend (port 3000) |
| `npm run dev:launcher` | Start backend, frontend, and the launcher GUI |
| `npm run build` | Build the frontend for production |
| `npm run launcher` | Launch the system GUI launcher |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend shows "disconnected" | Make sure `npm run backend` or `npm run dev` is running |
| Scripts don't execute on Linux | Install PowerShell Core: `sudo apt install powershell` |
| Port 3000 or 3001 in use | Stop other processes using those ports, or change them in the config |
| Hotkey scripts don't start (Windows) | Install [AutoHotkey v2](https://www.autohotkey.com/) |
| Quick launcher doesn't open | Use `Ctrl + Alt + L` while the app is focused in the browser |
| Path aliases not replaced | Ensure the alias exists in Path Manager and uses the exact `{{NAME}}` syntax |
| Secret values not injected | Set the value in Secret Manager (keys without values are skipped) |

---

## License

Private project.
