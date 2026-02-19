const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// Ensure user_data directory exists
const USER_DATA_DIR = path.join(__dirname, '..', 'user_data');
const WORKSPACES_DIR = path.join(USER_DATA_DIR, 'workspaces');
const SETTINGS_FILE = path.join(USER_DATA_DIR, 'settings.json');
const GLOBAL_PATHS_FILE = path.join(USER_DATA_DIR, 'global_paths.json');
const SECRET_KEYS_FILE = path.join(USER_DATA_DIR, 'secret_keys.json');
const SECRETS_DIR = path.join(USER_DATA_DIR, 'secrets');
const SECRET_VALUES_FILE = path.join(SECRETS_DIR, 'values.json');

if (!fs.existsSync(WORKSPACES_DIR)) {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

// Ensure secrets directory exists
if (!fs.existsSync(SECRETS_DIR)) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
}

// Default workspace setup
const DEFAULT_WS_NAME = 'Default';
const DEFAULT_WS_DIR = path.join(WORKSPACES_DIR, DEFAULT_WS_NAME);
if (!fs.existsSync(DEFAULT_WS_DIR)) {
  fs.mkdirSync(DEFAULT_WS_DIR, { recursive: true });
}

// Load settings or set defaults
let settings = { currentWorkspace: DEFAULT_WS_NAME };
if (fs.existsSync(SETTINGS_FILE)) {
  try {
    let content = fs.readFileSync(SETTINGS_FILE, 'utf8');
    // Strip BOM if it exists
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    settings = JSON.parse(content);
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

function getScriptsFilePath(workspaceName) {
  return path.join(WORKSPACES_DIR, workspaceName || settings.currentWorkspace, 'scripts.json');
}

function getGlobalPaths() {
  if (fs.existsSync(GLOBAL_PATHS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(GLOBAL_PATHS_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading global paths:', e);
    }
  }
  return [];
}

function getSecretKeys() {
  if (fs.existsSync(SECRET_KEYS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SECRET_KEYS_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading secret keys:', e);
    }
  }
  return [];
}

function getSecretValues() {
  if (fs.existsSync(SECRET_VALUES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SECRET_VALUES_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading secret values:', e);
    }
  }
  return {};
}

function saveSecretKeys(keys) {
  fs.writeFileSync(SECRET_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
}

function saveSecretValues(values) {
  fs.writeFileSync(SECRET_VALUES_FILE, JSON.stringify(values, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json());

// Endpoint to read files by absolute path
app.post('/api/read-files', async (req, res) => {
  console.log('Received /api/read-files request:', req.body.paths?.length, 'paths');
  const { paths } = req.body;
  if (!Array.isArray(paths)) {
    return res.status(400).json({ error: 'Paths must be an array' });
  }

  const results = [];
  for (const filePath of paths) {
    if (!filePath || filePath.trim() === '') continue;
    
    try {
      const normalizedPath = filePath.trim();
      if (fs.existsSync(normalizedPath)) {
        const stats = fs.statSync(normalizedPath);
        if (stats.isFile()) {
          const content = fs.readFileSync(normalizedPath, 'utf8');
          results.push({
            path: normalizedPath,
            content: content,
            success: true
          });
        } else if (stats.isDirectory()) {
          // For now, let's keep it simple and just report it's a directory
          // or we could recursively read it. The user asked for "paths to files".
          results.push({
            path: normalizedPath,
            error: 'Paths to directories are not supported in this box. Please use drag & drop for folders.',
            success: false
          });
        }
      } else {
        results.push({
          path: normalizedPath,
          error: 'File not found',
          success: false
        });
      }
    } catch (error) {
      results.push({
        path: filePath,
        error: error.message,
        success: false
      });
    }
  }
  res.json({ results });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PowerShell Backend Service is running' });
});

// Execute script endpoint (for external tools like AHK)
app.post('/api/execute', async (req, res) => {
  console.log('Received /api/execute request');
  const { script, scriptName, restoreFocus, scriptBase64 } = req.body;
  
  let scriptContent = script;
  if (scriptBase64) {
    try {
      scriptContent = Buffer.from(scriptBase64, 'base64').toString('utf8');
      console.log(`Decoded base64 script: ${scriptName}`);
    } catch (e) {
      console.error('Base64 decode error:', e);
      return res.status(400).json({ error: 'Invalid base64 script content' });
    }
  }

  if (!scriptContent) {
    console.error('No script content provided');
    return res.status(400).json({ error: 'Script content is required' });
  }

  try {
    const sessionId = uuidv4();
    const processedScript = replacePathAliases(scriptContent);
    
    // Prepare focus restoration code
    let focusRestoreCode = '';
    if (restoreFocus) {
      try {
        const lastWindowFile = path.join(USER_DATA_DIR, 'last_active_window.txt');
        if (fs.existsSync(lastWindowFile)) {
          const lastHwnd = fs.readFileSync(lastWindowFile, 'utf8').trim();
          if (lastHwnd) {
            console.log(`Preparing focus restore for HWND: ${lastHwnd}`);
            focusRestoreCode = `
    # Restore focus to previous window
    try {
        $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
        $type = Add-Type -MemberDefinition $sig -Name Win32 -Namespace Win32 -PassThru
        $hwnd = [IntPtr]::new(${lastHwnd})
        $null = $type::SetForegroundWindow($hwnd)
        Write-Host "Restored focus to previous window" -ForegroundColor Gray
    } catch {
        Write-Host "Failed to restore focus: $_" -ForegroundColor DarkGray
    }
`;
          }
        }
      } catch (e) {
        console.error('Error preparing focus restore:', e);
      }
    }

    const tempDir = os.tmpdir();
    const scriptFileName = `ps_script_${sessionId}.ps1`;
    const batchFileName = `run_script_${sessionId}.bat`;
    const scriptPath = path.join(tempDir, scriptFileName);
    const batchPath = path.join(tempDir, batchFileName);

    const psScript = `# PowerShell Script: ${scriptName || 'Unnamed Script'}
$Host.UI.RawUI.WindowTitle = "PowerShell Manager - ${scriptName || 'Unnamed Script'}"
try {
${processedScript}
${focusRestoreCode}
    Write-Host "=== Completed ===" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host "Press any key to close..." -ForegroundColor Yellow
try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Read-Host "Press Enter" }
`;

    const batchContent = `@echo off
title PowerShell Manager - ${scriptName || 'Unnamed Script'}
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"
`;

    fs.writeFileSync(scriptPath, psScript, 'utf8');
    fs.writeFileSync(batchPath, batchContent, 'utf8');

    console.log(`Spawning batch file: ${batchPath}`);
    const psProcess = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', batchPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    setTimeout(() => {
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        if (fs.existsSync(batchPath)) fs.unlinkSync(batchPath);
      } catch (e) {}
    }, 60000);

    psProcess.unref();

    res.json({ success: true, message: 'Script started' });

  } catch (error) {
    console.error('Error executing script via HTTP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Store running AutoHotkey processes
const runningAHKScripts = new Map(); // scriptId -> { process, scriptPath }

/**
 * Check whether the given path points to an executable file or alias.
 */
function pathPointsToExecutable(filePath) {
  if (!filePath) return false;
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isFile() || stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Try to find an AutoHotkey executable on the local machine.
 * Checks common install directories, PATH entries, Microsoft Store locations,
 * and an optional AUTOHOTKEY_PATH env override.
 * @returns {string|null} Full path to the AutoHotkey executable or null if not found.
 */
function findAutoHotkeyExecutable() {
  // Prioritize v2 executables and specific architectures to avoid the launcher prompt
  const candidateFileNames = [
    'AutoHotkey64.exe',
    'AutoHotkey32.exe',
    'AutoHotkey.exe',
    'AutoHotkeyU64.exe',
    'AutoHotkeyU32.exe',
    'AutoHotkeyUX.exe',
    'AutoHotkeyV2.exe',
    'AutoHotkeyV1.exe'
  ];

  const directoriesToCheck = new Set();

  const addDirectory = (dirPath) => {
    if (dirPath && typeof dirPath === 'string' && dirPath.trim()) {
      directoriesToCheck.add(dirPath.trim());
    }
  };

  // Allow explicit override for custom installs or portable versions
  const configuredPath = (process.env.AUTOHOTKEY_PATH || '').trim();
  if (configuredPath) {
    const normalized = configuredPath.replace(/^"(.*)"$/, '$1');
    if (pathPointsToExecutable(normalized)) {
      return normalized;
    }
    addDirectory(normalized);
  }

  const baseInstallRoots = [
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : null
  ].filter(Boolean);

  // Prioritize v2 directory
  const autoHotkeySubDirs = [
    path.join('AutoHotkey', 'v2'),
    'AutoHotkey',
    '',
    path.join('AutoHotkey', 'v1'),
    path.join('AutoHotkey', 'UX')
  ];

  for (const root of baseInstallRoots) {
    for (const subDir of autoHotkeySubDirs) {
      addDirectory(subDir ? path.join(root, subDir) : root);
    }
  }

  if (process.env.LOCALAPPDATA) {
    addDirectory(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'));

    const packagesDir = path.join(process.env.LOCALAPPDATA, 'Packages');
    try {
      const packages = fs.readdirSync(packagesDir, { withFileTypes: true });
      for (const pkg of packages) {
        if (!pkg.isDirectory()) continue;
        if (!pkg.name.toLowerCase().includes('autohotkey')) continue;

        const pkgRoot = path.join(packagesDir, pkg.name, 'LocalCache', 'Local', 'Microsoft', 'WritablePackageRoot', 'VFS');
        addDirectory(path.join(pkgRoot, 'ProgramFilesX64', 'AutoHotkey'));
        addDirectory(path.join(pkgRoot, 'ProgramFilesX64', 'AutoHotkey', 'v2'));
        addDirectory(path.join(pkgRoot, 'ProgramFilesX64', 'AutoHotkey', 'v1'));
        addDirectory(path.join(pkgRoot, 'ProgramFiles', 'AutoHotkey'));
        addDirectory(path.join(pkgRoot, 'ProgramFiles', 'AutoHotkey', 'v2'));
        addDirectory(path.join(pkgRoot, 'ProgramFiles', 'AutoHotkey', 'v1'));
      }
    } catch {
      // Packages directory may be inaccessible in some environments
    }
  }

  if (process.env.PATH) {
    for (const pathEntry of process.env.PATH.split(path.delimiter)) {
      addDirectory(pathEntry);
    }
  }

  for (const dir of directoriesToCheck) {
    if (!dir) continue;
    for (const fileName of candidateFileNames) {
      const candidatePath = path.join(dir, fileName);
      if (pathPointsToExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

/**
 * Replaces path aliases and secrets in the form of {{ALIAS}} with their actual values.
 * Path aliases are defined globally, secrets are stored locally (not in git).
 */
function replacePathAliases(scriptContent) {
  try {
    const paths = getGlobalPaths();
    const secretValues = getSecretValues();

    let processedContent = scriptContent;

    // Handle paths if it's an array (new format)
    if (Array.isArray(paths)) {
      paths.forEach(p => {
        if (p.alias && p.path) {
          const escapedAlias = p.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`{{${escapedAlias}}}`, 'g');
          // Use a function as the second argument to avoid special handling of $ in the path
          processedContent = processedContent.replace(regex, () => p.path);
        }
      });
    }
    // Handle paths if it's an object (legacy/alternative format)
    else if (typeof paths === 'object') {
      for (const [alias, actualPath] of Object.entries(paths)) {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`{{${escapedAlias}}}`, 'g');
        processedContent = processedContent.replace(regex, () => actualPath);
      }
    }

    // Replace secrets
    if (secretValues && typeof secretValues === 'object') {
      for (const [key, value] of Object.entries(secretValues)) {
        if (value) {
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`{{${escapedKey}}}`, 'g');
          processedContent = processedContent.replace(regex, () => value);
        }
      }
    }

    return processedContent;
  } catch (error) {
    console.error('Error replacing path aliases:', error);
    return scriptContent;
  }
}

/**
 * Renames a path alias globally and updates all scripts in all workspaces.
 */
async function handleRenamePathAlias(ws, data) {
  const { oldAlias, newAlias } = data;
  
  if (!oldAlias || !newAlias) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing oldAlias or newAlias' }));
    return;
  }

  try {
    // 1. Update global_paths.json
    let globalPaths = getGlobalPaths();
    let aliasFound = false;

    if (Array.isArray(globalPaths)) {
      globalPaths = globalPaths.map(p => {
        if (p.alias === oldAlias) {
          aliasFound = true;
          return { ...p, alias: newAlias };
        }
        return p;
      });
    }

    if (!aliasFound) {
      ws.send(JSON.stringify({ type: 'error', message: `Alias "${oldAlias}" not found in global paths` }));
      return;
    }

    fs.writeFileSync(GLOBAL_PATHS_FILE, JSON.stringify(globalPaths, null, 2));

    // 2. Update all scripts in all workspaces
    if (fs.existsSync(WORKSPACES_DIR)) {
      const workspaces = fs.readdirSync(WORKSPACES_DIR);
      
      for (const workspaceName of workspaces) {
        const scriptsPath = path.join(WORKSPACES_DIR, workspaceName, 'scripts.json');
        
        if (fs.existsSync(scriptsPath)) {
          try {
            const scriptsData = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));
            let scriptsChanged = false;

            // Helper to replace alias in script content
            const updateContent = (content) => {
              if (!content) return content;
              const escapedOldAlias = oldAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`{{${escapedOldAlias}}}`, 'g');
              const newContent = content.replace(regex, `{{${newAlias}}}`);
              if (newContent !== content) {
                scriptsChanged = true;
              }
              return newContent;
            };

            // Update PowerShell scripts
            if (scriptsData.powershell && Array.isArray(scriptsData.powershell)) {
              scriptsData.powershell = scriptsData.powershell.map(s => ({
                ...s,
                content: updateContent(s.content)
              }));
            }

            // Update AHK scripts
            if (scriptsData.ahk && Array.isArray(scriptsData.ahk)) {
              scriptsData.ahk = scriptsData.ahk.map(s => ({
                ...s,
                content: updateContent(s.content)
              }));
            }

            if (scriptsChanged) {
              fs.writeFileSync(scriptsPath, JSON.stringify(scriptsData, null, 2));
              console.log(`Updated scripts in workspace: ${workspaceName}`);
            }
          } catch (err) {
            console.error(`Error updating scripts in workspace ${workspaceName}:`, err);
          }
        }
      }
    }

    ws.send(JSON.stringify({ 
      type: 'alias_renamed', 
      oldAlias, 
      newAlias,
      message: `Successfully renamed alias "${oldAlias}" to "${newAlias}" and updated all scripts.`
    }));

    // Also broadcast the updated global paths to all clients
    const updatedPaths = getGlobalPaths();
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'global_paths', paths: updatedPaths }));
      }
    });

  } catch (error) {
    console.error('Error renaming path alias:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to rename alias' }));
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'execute':
          await handleScriptExecution(ws, data);
          break;
        case 'ahk_run':
          await handleAHKRun(ws, data);
          break;
        case 'ahk_stop':
          await handleAHKStop(ws, data);
          break;
        case 'ahk_status':
          handleAHKStatus(ws);
          break;
        case 'ahk_register_autostart':
          // Future: handle auto-start registration
          break;
        case 'ahk_unregister_autostart':
          // Future: handle auto-start unregistration
          break;
        case 'save_data':
          handleSaveData(ws, data);
          break;
        case 'load_data':
          handleLoadData(ws);
          break;
        case 'list_workspaces':
          handleListWorkspaces(ws);
          break;
        case 'create_workspace':
          handleCreateWorkspace(ws, data);
          break;
        case 'switch_workspace':
          handleSwitchWorkspace(ws, data);
          break;
        case 'delete_workspace':
          handleDeleteWorkspace(ws, data);
          break;
        case 'rename_path_alias':
          handleRenamePathAlias(ws, data);
          break;
        case 'load_secrets':
          handleLoadSecrets(ws);
          break;
        case 'add_secret_key':
          handleAddSecretKey(ws, data);
          break;
        case 'save_secret_value':
          handleSaveSecretValue(ws, data);
          break;
        case 'delete_secret_key':
          handleDeleteSecretKey(ws, data);
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing request'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

async function handleScriptExecution(ws, data) {
  const sessionId = uuidv4();
  const { script, scriptName, restoreFocus } = data;

  try {
    // Replace path aliases before execution
    const processedScript = replacePathAliases(script);

    // Send execution start message
    ws.send(JSON.stringify({
      type: 'execution_start',
      sessionId,
      message: `Opening new console window for "${scriptName || 'Unnamed Script'}"`
    }));

    // Create temporary files
    const tempDir = os.tmpdir();
    const scriptFileName = `ps_script_${sessionId}.ps1`;
    const batchFileName = `run_script_${sessionId}.bat`;
    const scriptPath = path.join(tempDir, scriptFileName);
    const batchPath = path.join(tempDir, batchFileName);

    // Prepare focus restoration code
    let focusRestoreCode = '';
    if (restoreFocus) {
      try {
        const lastWindowFile = path.join(USER_DATA_DIR, 'last_active_window.txt');
        if (fs.existsSync(lastWindowFile)) {
          const lastHwnd = fs.readFileSync(lastWindowFile, 'utf8').trim();
          if (lastHwnd) {
            focusRestoreCode = `
    # Restore focus to previous window
    try {
        $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
        $type = Add-Type -MemberDefinition $sig -Name Win32 -Namespace Win32 -PassThru
        $hwnd = [IntPtr]::new(${lastHwnd})
        $null = $type::SetForegroundWindow($hwnd)
        Write-Host "Restored focus to previous window (HWND: ${lastHwnd})" -ForegroundColor Gray
    } catch {
        Write-Host "Failed to restore focus: $_" -ForegroundColor DarkGray
    }
`;
          }
        }
      } catch (e) {
        console.error('Error preparing focus restore:', e);
      }
    }

    // Create PowerShell script with proper formatting
    const psScript = `# PowerShell Script: ${scriptName || 'Unnamed Script'}
# Generated by PowerShell Manager
$Host.UI.RawUI.WindowTitle = "PowerShell Manager - ${scriptName || 'Unnamed Script'}"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "PowerShell Manager - Executing: ${scriptName || 'Unnamed Script'}" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # User script starts here
${processedScript}
    # User script ends here
    ${focusRestoreCode}
    Write-Host ""
    Write-Host "=== Script execution completed successfully ===" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "=== Error occurred during script execution ===" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Yellow
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Read-Host "Press Enter to close"
}
`;

    // Create diagnostic batch file
    const batchContent = `@echo off
title PowerShell Manager - ${scriptName || 'Unnamed Script'}
echo ========================================
echo PowerShell Manager Debug Information
echo ========================================
echo Script Name: ${scriptName || 'Unnamed Script'}
echo Script Path: ${scriptPath}
echo Batch Path: ${batchPath}
echo Current Directory: %CD%
echo Temp Directory: %TEMP%
echo.
echo Checking if PowerShell script exists...
if exist "${scriptPath}" (
    echo ✓ PowerShell script file exists
    echo File size: 
    dir "${scriptPath}" | findstr ".ps1"
) else (
    echo ✗ PowerShell script file NOT found!
    echo This is the problem - script file was not created properly
    pause
    exit
)
echo.
echo Starting PowerShell execution...
echo Command: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"
echo.
echo PowerShell execution finished with exit code: %ERRORLEVEL%
echo.
pause
`;

    // Write both files
    fs.writeFileSync(scriptPath, psScript, 'utf8');
    fs.writeFileSync(batchPath, batchContent, 'utf8');

    // Log the file paths for debugging
    console.log('Created PowerShell script:', scriptPath);
    console.log('Created batch file:', batchPath);
    console.log('Script content preview:', script.substring(0, 100) + '...');

    // Launch batch file in a new console window with debugging
    const psProcess = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', batchPath], {
      detached: true,
      stdio: 'ignore'
    });

    // Clean up the temporary files after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
        if (fs.existsSync(batchPath)) {
          fs.unlinkSync(batchPath);
        }
      } catch (error) {
        console.log('Note: Could not clean up temporary files:', error.message);
      }
    }, 60000); // Increased to 60 seconds for debugging

    psProcess.unref(); // Allow the process to run independently

    // Send completion message immediately
    ws.send(JSON.stringify({
      type: 'execution_complete',
      sessionId,
      message: `Script launched in new console window. The window will close automatically when completed.`
    }));

  } catch (error) {
    console.error('Error executing script:', error);
    ws.send(JSON.stringify({
      type: 'error',
      sessionId,
      message: `Execution error: ${error.message}`
    }));
  }
}

// AutoHotkey script handlers
async function runAHKScriptInternal(scriptId, scriptContent, scriptName, ws = null) {
  try {
    // Replace path aliases before execution
    const processedScript = replacePathAliases(scriptContent);

    // Check if script is already running
    if (runningAHKScripts.has(scriptId)) {
      const msg = `Script "${scriptName}" is already running. Stop it first.`;
      console.log(msg);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'error',
          message: msg
        }));
      }
      return;
    }

    // Find AutoHotkey executable
    const ahkPath = findAutoHotkeyExecutable();

    if (!ahkPath) {
      const msg = 'AutoHotkey executable not found. Install AutoHotkey or set AUTOHOTKEY_PATH to the executable.';
      console.error(msg);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'error',
          message: msg
        }));
      }
      return;
    }

    // Create temporary script file
    const tempDir = os.tmpdir();
    const scriptFileName = `ahk_script_${scriptId}.ahk`;
    const scriptPath = path.join(tempDir, scriptFileName);

    // Write script to file
    fs.writeFileSync(scriptPath, processedScript, 'utf8');
    console.log('Created AutoHotkey script:', scriptPath);

    // Launch AutoHotkey script
    const ahkProcess = spawn(ahkPath, [scriptPath], {
      detached: false,
      stdio: 'ignore'
    });

    // Store the running process
    runningAHKScripts.set(scriptId, {
      process: ahkProcess,
      scriptPath: scriptPath
    });

    ahkProcess.on('exit', (code) => {
      console.log(`AutoHotkey script ${scriptName} exited with code ${code}`);
      runningAHKScripts.delete(scriptId);
      
      // Clean up script file
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      } catch (error) {
        console.log('Could not clean up script file:', error.message);
      }

      // Notify client if connected
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ahk_stop',
          scriptId: scriptId,
          message: `Script "${scriptName}" has stopped.`
        }));
      }
    });

    if (ws) {
      ws.send(JSON.stringify({
        type: 'ahk_start',
        scriptId: scriptId,
        message: `Script "${scriptName}" started successfully.`
      }));
    }

  } catch (error) {
    console.error('Error running AutoHotkey script:', error);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to run script: ${error.message}`
      }));
    }
  }
}

async function handleAHKRun(ws, data) {
  const { scriptId, script, scriptName } = data;
  await runAHKScriptInternal(scriptId, script, scriptName, ws);
}

async function handleAHKStop(ws, data) {
  const { scriptId, scriptName } = data;

  try {
    const scriptInfo = runningAHKScripts.get(scriptId);
    
    if (!scriptInfo) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Script "${scriptName}" is not running.`
      }));
      return;
    }

    // Kill the AutoHotkey process
    scriptInfo.process.kill();
    
    // Clean up script file
    try {
      if (fs.existsSync(scriptInfo.scriptPath)) {
        fs.unlinkSync(scriptInfo.scriptPath);
      }
    } catch (error) {
      console.log('Could not clean up script file:', error.message);
    }

    runningAHKScripts.delete(scriptId);

    ws.send(JSON.stringify({
      type: 'ahk_stop',
      scriptId: scriptId,
      message: `Script "${scriptName}" stopped successfully.`
    }));

  } catch (error) {
    console.error('Error stopping AutoHotkey script:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to stop script: ${error.message}`
    }));
  }
}

function handleAHKStatus(ws) {
  const runningScriptIds = Array.from(runningAHKScripts.keys());
  
  ws.send(JSON.stringify({
    type: 'ahk_status',
    running: runningScriptIds
  }));
}

function handleSaveData(ws, data) {
  const { dataType, content } = data;
  try {
    if (dataType === 'paths') {
      fs.writeFileSync(GLOBAL_PATHS_FILE, JSON.stringify(content, null, 2), 'utf8');
      console.log('Saved global paths');
    } else {
      const scriptsFile = getScriptsFilePath();
      let allData = {};
      if (fs.existsSync(scriptsFile)) {
        allData = JSON.parse(fs.readFileSync(scriptsFile, 'utf8'));
      }
      
      allData[dataType] = content;
      fs.writeFileSync(scriptsFile, JSON.stringify(allData, null, 2), 'utf8');
      console.log(`Saved ${dataType} to workspace "${settings.currentWorkspace}"`);
    }
    
    ws.send(JSON.stringify({
      type: 'save_success',
      dataType,
      message: `Successfully saved ${dataType} to disk`
    }));
  } catch (error) {
    console.error('Error saving data:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to save data: ${error.message}`
    }));
  }
}

function handleLoadData(ws) {
  try {
    const scriptsFile = getScriptsFilePath();
    let allData = {};
    
    if (fs.existsSync(scriptsFile)) {
      allData = JSON.parse(fs.readFileSync(scriptsFile, 'utf8'));
    }
    
    // Always include global paths
    allData.paths = getGlobalPaths();

    ws.send(JSON.stringify({
      type: 'load_data',
      content: allData,
      workspace: settings.currentWorkspace
    }));
    console.log(`Sent data for workspace "${settings.currentWorkspace}" to client (including global paths)`);
  } catch (error) {
    console.error('Error loading data:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to load data: ${error.message}`
    }));
  }
}

function handleListWorkspaces(ws) {
  try {
    const workspaces = fs.readdirSync(WORKSPACES_DIR)
      .filter(file => fs.statSync(path.join(WORKSPACES_DIR, file)).isDirectory());
    
    ws.send(JSON.stringify({
      type: 'workspace_list',
      workspaces,
      current: settings.currentWorkspace
    }));
  } catch (error) {
    console.error('Error listing workspaces:', error);
  }
}

function handleCreateWorkspace(ws, data) {
  const { name } = data;
  if (!name) return;
  
  try {
    const wsDir = path.join(WORKSPACES_DIR, name);
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
      console.log(`Created workspace: ${name}`);
      handleListWorkspaces(ws);
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Workspace already exists' }));
    }
  } catch (error) {
    console.error('Error creating workspace:', error);
  }
}

function handleSwitchWorkspace(ws, data) {
  const { name } = data;
  if (!name) return;
  
  try {
    const wsDir = path.join(WORKSPACES_DIR, name);
    if (fs.existsSync(wsDir)) {
      settings.currentWorkspace = name;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Switched to workspace: ${name}`);
      
      // Notify client and send new data
      ws.send(JSON.stringify({
        type: 'workspace_switched',
        workspace: name
      }));
      handleLoadData(ws);
    }
  } catch (error) {
    console.error('Error switching workspace:', error);
  }
}

function handleDeleteWorkspace(ws, data) {
  const { name } = data;
  if (!name || name === DEFAULT_WS_NAME) return;

  try {
    const wsDir = path.join(WORKSPACES_DIR, name);
    if (fs.existsSync(wsDir)) {
      // Simple recursive delete
      fs.rmSync(wsDir, { recursive: true, force: true });
      console.log(`Deleted workspace: ${name}`);

      if (settings.currentWorkspace === name) {
        settings.currentWorkspace = DEFAULT_WS_NAME;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
      }

      handleListWorkspaces(ws);
    }
  } catch (error) {
    console.error('Error deleting workspace:', error);
  }
}

// Secret management handlers
function handleLoadSecrets(ws) {
  try {
    const keys = getSecretKeys();
    const values = getSecretValues();

    // Merge keys with their values
    const secrets = keys.map(keyObj => ({
      key: keyObj.key,
      description: keyObj.description || '',
      value: values[keyObj.key] || ''
    }));

    ws.send(JSON.stringify({
      type: 'secrets_data',
      secrets: secrets
    }));
    console.log(`Sent ${secrets.length} secrets to client`);
  } catch (error) {
    console.error('Error loading secrets:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to load secrets: ${error.message}`
    }));
  }
}

function handleAddSecretKey(ws, data) {
  const { key, description } = data;

  if (!key) {
    ws.send(JSON.stringify({ type: 'error', message: 'Secret key name is required' }));
    return;
  }

  try {
    const keys = getSecretKeys();

    // Check if key already exists
    if (keys.some(k => k.key === key)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Secret key already exists' }));
      return;
    }

    // Add new key
    keys.push({ key, description: description || '' });
    saveSecretKeys(keys);

    // Initialize empty value for the key
    const values = getSecretValues();
    values[key] = '';
    saveSecretValues(values);

    console.log(`Added secret key: ${key}`);
    ws.send(JSON.stringify({
      type: 'secret_key_added',
      message: `Secret key "${key}" added successfully`
    }));
  } catch (error) {
    console.error('Error adding secret key:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to add secret key: ${error.message}`
    }));
  }
}

function handleSaveSecretValue(ws, data) {
  const { key, value } = data;

  if (!key) {
    ws.send(JSON.stringify({ type: 'error', message: 'Secret key is required' }));
    return;
  }

  try {
    const values = getSecretValues();
    values[key] = value || '';
    saveSecretValues(values);

    console.log(`Saved value for secret: ${key}`);
    ws.send(JSON.stringify({
      type: 'secret_saved',
      message: `Secret "${key}" saved successfully`
    }));
  } catch (error) {
    console.error('Error saving secret value:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to save secret: ${error.message}`
    }));
  }
}

function handleDeleteSecretKey(ws, data) {
  const { key } = data;

  if (!key) {
    ws.send(JSON.stringify({ type: 'error', message: 'Secret key is required' }));
    return;
  }

  try {
    // Remove from keys file
    let keys = getSecretKeys();
    keys = keys.filter(k => k.key !== key);
    saveSecretKeys(keys);

    // Remove from values file
    const values = getSecretValues();
    delete values[key];
    saveSecretValues(values);

    console.log(`Deleted secret key: ${key}`);
    ws.send(JSON.stringify({
      type: 'secret_deleted',
      message: `Secret "${key}" deleted successfully`
    }));
  } catch (error) {
    console.error('Error deleting secret key:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to delete secret: ${error.message}`
    }));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Stop all running AutoHotkey scripts
  for (const [scriptId, scriptInfo] of runningAHKScripts.entries()) {
    try {
      scriptInfo.process.kill();
      if (fs.existsSync(scriptInfo.scriptPath)) {
        fs.unlinkSync(scriptInfo.scriptPath);
      }
    } catch (error) {
      console.log(`Could not stop script ${scriptId}:`, error.message);
    }
  }
  runningAHKScripts.clear();
  
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

function startAutoStartScripts() {
  console.log('Checking for auto-start scripts...');
  const scriptsFile = getScriptsFilePath();
  if (fs.existsSync(scriptsFile)) {
    try {
      const scriptsData = JSON.parse(fs.readFileSync(scriptsFile, 'utf8'));
      const hotkeyScripts = scriptsData['hotkey-scripts'] || {};
      
      let count = 0;
      for (const [id, script] of Object.entries(hotkeyScripts)) {
        if (script.autoStart) {
          console.log(`Auto-starting script: ${script.name} (${id})`);
          runAHKScriptInternal(id, script.content, script.name);
          count++;
        }
      }
      console.log(`Started ${count} auto-start scripts.`);
    } catch (e) {
      console.error('Error starting auto-start scripts:', e);
    }
  } else {
    console.log('No scripts file found for current workspace.');
  }
}

server.listen(PORT, () => {
  console.log('===================================================');
  console.log(`PowerShell Backend Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('API Endpoint /api/read-files is READY');
  console.log('===================================================');
  
  // Start auto-start scripts after server is up
  startAutoStartScripts();
});
