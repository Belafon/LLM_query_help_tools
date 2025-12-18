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

if (!fs.existsSync(WORKSPACES_DIR)) {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

// Default workspace setup
const DEFAULT_WS_NAME = 'WebApi Server';
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

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PowerShell Backend Service is running' });
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
  const candidateFileNames = [
    'AutoHotkey.exe',
    'AutoHotkey64.exe',
    'AutoHotkey32.exe',
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

  const autoHotkeySubDirs = [
    '',
    'AutoHotkey',
    path.join('AutoHotkey', 'v2'),
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
 * Replaces path aliases in the form of {{ALIAS}} with their actual paths
 * defined in the current workspace.
 */
function replacePathAliases(scriptContent) {
  try {
    const paths = getGlobalPaths();

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

    return processedContent;
  } catch (error) {
    console.error('Error replacing path aliases:', error);
    return scriptContent;
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
  const { script, scriptName } = data;

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
async function handleAHKRun(ws, data) {
  const { scriptId, script, scriptName } = data;

  try {
    // Replace path aliases before execution
    const processedScript = replacePathAliases(script);

    // Check if script is already running
    if (runningAHKScripts.has(scriptId)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Script "${scriptName}" is already running. Stop it first.`
      }));
      return;
    }

    // Find AutoHotkey executable
    const ahkPath = findAutoHotkeyExecutable();

    if (!ahkPath) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'AutoHotkey executable not found. Install AutoHotkey or set AUTOHOTKEY_PATH to the executable.'
      }));
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

      // Notify client
      ws.send(JSON.stringify({
        type: 'ahk_stop',
        scriptId: scriptId,
        message: `Script "${scriptName}" has stopped.`
      }));
    });

    ws.send(JSON.stringify({
      type: 'ahk_start',
      scriptId: scriptId,
      message: `Script "${scriptName}" started successfully.`
    }));

  } catch (error) {
    console.error('Error running AutoHotkey script:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to run script: ${error.message}`
    }));
  }
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

server.listen(PORT, () => {
  console.log(`PowerShell Backend Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
