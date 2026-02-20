import React, { useState, useEffect, useRef } from 'react';
import { WEBSOCKET_URL } from '../config/backend';
import './HotkeyManager.css';

const HotkeyManager = () => {
  const [scripts, setScripts] = useState({});
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'edit', 'create'
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [output, setOutput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [compactView, setCompactView] = useState(true);

  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [runningScripts, setRunningScripts] = useState(new Set());
  const [currentWorkspace, setCurrentWorkspace] = useState('Default');
  const [workspaces, setWorkspaces] = useState([]);
  const wsRef = useRef(null);

  const connectToBackend = () => {
    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Hotkey backend');
        setBackendStatus('connected');
        // Request status of running AutoHotkey scripts
        ws.send(JSON.stringify({ type: 'ahk_status' }));
        // Request data from disk
        ws.send(JSON.stringify({ type: 'load_data' }));
        // Request workspace list
        ws.send(JSON.stringify({ type: 'list_workspaces' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onclose = () => {
        console.log('Disconnected from Hotkey backend');
        setBackendStatus('disconnected');
        // Try to reconnect after 3 seconds
        setTimeout(connectToBackend, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setBackendStatus('error');
      };

    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setBackendStatus('error');
    }
  };

  // Load scripts from localStorage on component mount
  useEffect(() => {
    console.log('Loading hotkey scripts from localStorage...');
    const savedScripts = localStorage.getItem('hotkey-scripts');
    console.log('Found saved scripts:', savedScripts);
    
    if (savedScripts) {
      try {
        const parsedScripts = JSON.parse(savedScripts);
        console.log('Parsed scripts:', parsedScripts);
        setScripts(parsedScripts);
      } catch (error) {
        console.error('Error loading scripts:', error);
      }
    } else {
      console.log('No saved scripts found in localStorage');
    }
    
    setScriptsLoaded(true);
    
    // Initialize WebSocket connection
    connectToBackend();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scripts to localStorage whenever scripts change
  useEffect(() => {
    // Only save after scripts have been loaded from localStorage
    if (scriptsLoaded) {
      console.log('Saving hotkey scripts to localStorage:', scripts);
      localStorage.setItem('hotkey-scripts', JSON.stringify(scripts));
      console.log('Scripts saved to localStorage');

      // Also sync to disk via backend
      if (backendStatus === 'connected' && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'save_data',
          dataType: 'hotkey-scripts',
          content: scripts
        }));
      }
    }
  }, [scripts, scriptsLoaded, backendStatus]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'ahk_start':
        setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${data.message}\n`);
        if (data.scriptId) {
          setRunningScripts(prev => new Set([...prev, data.scriptId]));
        }
        break;

      case 'load_data':
        if (data.content && data.content['hotkey-scripts']) {
          console.log('Loaded hotkey scripts from disk');
          setScripts(data.content['hotkey-scripts']);
        } else {
          setScripts({}); // Clear if no scripts in this workspace
        }
        if (data.workspace) {
          setCurrentWorkspace(data.workspace);
        }
        break;

      case 'workspace_list':
        setWorkspaces(data.workspaces || []);
        if (data.current) {
          setCurrentWorkspace(data.current);
        }
        break;

      case 'workspace_switched':
        setCurrentWorkspace(data.workspace);
        setOutput(prev => prev + `[SYSTEM] Switched to workspace: ${data.workspace}\n`);
        // Reload data for the new workspace
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'load_data' }));
          wsRef.current.send(JSON.stringify({ type: 'ahk_status' }));
        }
        break;

      case 'ahk_stop':
        setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${data.message}\n`);
        if (data.scriptId) {
          setRunningScripts(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.scriptId);
            return newSet;
          });
        }
        break;
      
      case 'ahk_status':
        if (data.running) {
          setRunningScripts(new Set(data.running));
        }
        break;
      
      case 'execution_complete':
        setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${data.message}\n\n`);
        break;
      
      case 'error':
        setOutput(prev => prev + `[ERROR] ${data.data || data.message}\n`);
        break;
      
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleCreateNew = () => {
    setCurrentView('create');
    setSelectedScript(null);
    setScriptName('');
    setScriptContent('');
    setEditMode(true);
  };

  const handleSelectScript = (scriptId) => {
    const script = scripts[scriptId];
    if (script) {
      setSelectedScript(scriptId);
      setScriptName(script.name);
      setScriptContent(script.content);
      setCurrentView('edit');
      setEditMode(false);
      setOutput('');
    }
  };

  const handleSaveScript = () => {
    if (!scriptName.trim() || !scriptContent.trim()) {
      alert('Please provide both script name and content');
      return;
    }

    const scriptId = selectedScript || Date.now().toString();
    const newScripts = {
      ...scripts,
      [scriptId]: {
        name: scriptName.trim(),
        content: scriptContent,
        autoStart: scripts[scriptId]?.autoStart || false
      }
    };

    setScripts(newScripts);
    setSelectedScript(scriptId);
    setEditMode(false);
    setCurrentView('edit');
  };

  const handleDeleteScript = (scriptId) => {
    if (window.confirm('Are you sure you want to delete this script?')) {
      // Stop the script if it's running
      if (runningScripts.has(scriptId)) {
        handleStopScript(scriptId);
      }
      
      const newScripts = { ...scripts };
      delete newScripts[scriptId];
      setScripts(newScripts);
      
      if (selectedScript === scriptId) {
        setCurrentView('list');
        setSelectedScript(null);
        setScriptName('');
        setScriptContent('');
      }
    }
  };

  const handleRunScript = (scriptId) => {
    const script = scripts[scriptId];
    if (!script) {
      alert('Script not found');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend service is not connected. Please make sure the backend is running on port 3456.');
      return;
    }

    setOutput(`[${new Date().toLocaleTimeString()}] Starting "${script.name}"...\n`);

    try {
      const message = {
        type: 'ahk_run',
        scriptId: scriptId,
        script: script.content,
        scriptName: script.name
      };

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      setOutput(prev => prev + `Error: ${error.message}\n`);
    }
  };

  const handleStopScript = (scriptId) => {
    const script = scripts[scriptId];
    if (!script) {
      alert('Script not found');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend service is not connected.');
      return;
    }

    setOutput(`[${new Date().toLocaleTimeString()}] Stopping "${script.name}"...\n`);

    try {
      const message = {
        type: 'ahk_stop',
        scriptId: scriptId,
        scriptName: script.name
      };

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      setOutput(prev => prev + `Error: ${error.message}\n`);
    }
  };

  const handleToggleAutoStart = (scriptId) => {
    const script = scripts[scriptId];
    if (!script) return;

    const newScripts = {
      ...scripts,
      [scriptId]: {
        ...script,
        autoStart: !script.autoStart
      }
    };

    setScripts(newScripts);

    // If enabling auto-start and backend is connected, register with backend
    if (!script.autoStart && backendStatus === 'connected') {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'ahk_register_autostart',
          scriptId: scriptId,
          scriptName: script.name,
          script: script.content
        }));
      } catch (error) {
        console.error('Error registering auto-start:', error);
      }
    } else if (script.autoStart && backendStatus === 'connected') {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'ahk_unregister_autostart',
          scriptId: scriptId
        }));
      } catch (error) {
        console.error('Error unregistering auto-start:', error);
      }
    }
  };

  const handleSwitchWorkspace = (e) => {
    const workspaceName = e.target.value;
    if (workspaceName && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'switch_workspace',
        name: workspaceName
      }));
    }
  };

  const renderScriptList = () => (
    <div className="script-list-view">
      <div className="view-header">
        <div className="header-title-group">
          <h2>AutoHotkey Scripts</h2>
          <div className="workspace-badge">
            Workspace: 
            <select 
              className="workspace-select" 
              value={currentWorkspace} 
              onChange={handleSwitchWorkspace}
            >
              {workspaces.map(ws => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary toggle-view-btn"
            onClick={() => setCompactView(!compactView)}
          >
            {compactView ? '☰ Expand' : '⚊ Compact'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleCreateNew}
          >
            + New Script
          </button>
        </div>
      </div>

      <div className="backend-status">
        <span className={`status-indicator ${backendStatus}`}>
          {backendStatus === 'connected' ? '● Connected' : 
           backendStatus === 'error' ? '● Error' : '○ Disconnected'}
        </span>
      </div>

      {Object.keys(scripts).length === 0 ? (
        <div className="empty-state">
          <p>No AutoHotkey scripts yet. Create your first one!</p>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            + Create First Script
          </button>
        </div>
      ) : (
        <div className={`scripts-grid ${compactView ? 'compact' : 'expanded'}`}>
          {Object.entries(scripts).map(([id, script]) => (
            <div 
              key={id} 
              className={`script-card ${runningScripts.has(id) ? 'running' : ''}`}
            >
              <div className="script-card-header">
                <h3 
                  className="script-title"
                  onClick={() => handleSelectScript(id)}
                  title="Click to view/edit"
                >
                  {script.name}
                </h3>
                <div className="script-status">
                  {runningScripts.has(id) && (
                    <span className="status-badge running">● Running</span>
                  )}
                </div>
              </div>
              
              {!compactView && (
                <div className="script-preview">
                  <pre>{script.content.substring(0, 150)}...</pre>
                </div>
              )}
              
              <div className="script-actions">
                <button
                  className="btn btn-icon"
                  onClick={() => handleSelectScript(id)}
                  title="Edit Script"
                >
                  ✎ Edit
                </button>
                {runningScripts.has(id) ? (
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => handleStopScript(id)}
                    title="Stop Script"
                  >
                    ■ Stop
                  </button>
                ) : (
                  <button
                    className="btn btn-success btn-icon"
                    onClick={() => handleRunScript(id)}
                    title="Run Script"
                  >
                    ▶ Run
                  </button>
                )}
                <button
                  className={`btn btn-icon ${script.autoStart ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={() => handleToggleAutoStart(id)}
                  title={script.autoStart ? 'Disable Auto-Start' : 'Enable Auto-Start'}
                >
                  {script.autoStart ? '★' : '☆'} Auto
                </button>
                <button
                  className="btn btn-danger btn-icon"
                  onClick={() => handleDeleteScript(id)}
                  title="Delete Script"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScriptEditor = () => (
    <div className="script-editor-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setCurrentView('list');
              setEditMode(false);
            }}
          >
            ← Back
          </button>
          <h2>{currentView === 'create' ? 'Create New Script' : 'Script Details'}</h2>
        </div>
        <div className="header-actions">
          {!editMode && currentView === 'edit' && (
            <button 
              className="btn btn-primary"
              onClick={() => setEditMode(true)}
            >
              Edit Script
            </button>
          )}
          {editMode && (
            <button 
              className="btn btn-success"
              onClick={handleSaveScript}
            >
              💾 Save
            </button>
          )}
        </div>
      </div>

      <div className="editor-container">
        <div className="form-group">
          <label htmlFor="scriptName">Script Name</label>
          <input
            id="scriptName"
            type="text"
            className="form-input"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            placeholder="e.g., VSCode Shortcut, Open Browser"
            disabled={!editMode}
          />
        </div>

        <div className="form-group">
          <label htmlFor="scriptContent">
            AutoHotkey Script
            <span className="label-hint">
              (Use AutoHotkey v1 or v2 syntax)
            </span>
          </label>
          <textarea
            id="scriptContent"
            className="form-textarea"
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            placeholder={`Example:
; Ctrl + Win + 2 to activate or open VSCode with specific project
^#2::
{
    projectPath := "C:\\Users\\YourName\\Documents\\project"
    
    ; Set title matching mode to search for partial titles
    SetTitleMatchMode, 2
    
    ; Check if a VSCode window with this path exists
    if WinExist("project ahk_exe Code.exe") or WinExist(projectPath " ahk_exe Code.exe")
    {
        ; Window exists, activate it
        WinActivate
    }
    else
    {
        ; Window doesn't exist, open VSCode with the project
        Run, code "%projectPath%"
    }
    return
}`}
            disabled={!editMode}
            rows={20}
          />
        </div>

        {selectedScript && !editMode && (
          <div className="script-controls">
            <div className="control-group">
              <button
                className={`btn ${runningScripts.has(selectedScript) ? 'btn-danger' : 'btn-success'}`}
                onClick={() => runningScripts.has(selectedScript) 
                  ? handleStopScript(selectedScript) 
                  : handleRunScript(selectedScript)}
                disabled={backendStatus !== 'connected'}
              >
                {runningScripts.has(selectedScript) ? '■ Stop Script' : '▶ Run Script'}
              </button>
              <button
                className={`btn ${scripts[selectedScript]?.autoStart ? 'btn-warning' : 'btn-secondary'}`}
                onClick={() => handleToggleAutoStart(selectedScript)}
              >
                {scripts[selectedScript]?.autoStart ? '★ Auto-Start Enabled' : '☆ Enable Auto-Start'}
              </button>
            </div>
            
            {runningScripts.has(selectedScript) && (
              <div className="status-message running">
                <span className="status-icon">●</span> Script is currently running
              </div>
            )}
          </div>
        )}
      </div>

      {output && (
        <div className="output-section">
          <h3>Output</h3>
          <div className="output-terminal">
            <pre>{output}</pre>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="hotkey-manager">
      <div className="container">
        {currentView === 'list' ? renderScriptList() : renderScriptEditor()}
      </div>
    </div>
  );
};

export default HotkeyManager;
