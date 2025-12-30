import React, { useState, useEffect, useRef } from 'react';
import './PowerShellManager.css';

const PowerShellManager = () => {
  const [scripts, setScripts] = useState({});
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'edit', 'create'
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [compactView, setCompactView] = useState(true);

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [currentWorkspace, setCurrentWorkspace] = useState('Default');
  const [workspaces, setWorkspaces] = useState([]);
  const wsRef = useRef(null);

  const connectToBackend = () => {
    try {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to PowerShell backend');
        setBackendStatus('connected');
        // Request data from disk
        ws.send(JSON.stringify({ type: 'load_data' }));
        ws.send(JSON.stringify({ type: 'list_workspaces' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onclose = () => {
        console.log('Disconnected from PowerShell backend');
        setBackendStatus('disconnected');
        setIsExecuting(false);
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
    console.log('Loading scripts from localStorage...');
    const savedScripts = localStorage.getItem('powershell-scripts');
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
      console.log('Saving scripts to localStorage:', scripts);
      localStorage.setItem('powershell-scripts', JSON.stringify(scripts));
      console.log('Scripts saved to localStorage');

      // Also sync to disk via backend
      if (backendStatus === 'connected' && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'save_data',
          dataType: 'powershell-scripts',
          content: scripts
        }));
      }
    }
  }, [scripts, scriptsLoaded, backendStatus]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'execution_start':
        setCurrentSessionId(data.sessionId);
        setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${data.message}\n`);
        break;
      
      case 'execution_complete':
        setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${data.message}\n\n`);
        setIsExecuting(false);
        setCurrentSessionId(null);
        break;
      
      case 'load_data':
        if (data.content && data.content['powershell-scripts']) {
          console.log('Loaded powershell scripts from disk');
          setScripts(data.content['powershell-scripts']);
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
        }
        break;
      
      case 'error':
        setOutput(prev => prev + `[ERROR] ${data.data || data.message}\n`);
        setIsExecuting(false);
        setCurrentSessionId(null);
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
        content: scriptContent
      }
    };

    setScripts(newScripts);
    setSelectedScript(scriptId);
    setEditMode(false);
    setCurrentView('edit');
  };

  const handleDeleteScript = (scriptId) => {
    if (window.confirm('Are you sure you want to delete this script?')) {
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

  const handleExecuteFromList = (scriptId) => {
    const script = scripts[scriptId];
    if (!script) {
      alert('Script not found');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend service is not connected. Please make sure the backend is running on port 3001.');
      return;
    }

    setIsExecuting(true);
    setOutput(`[${new Date().toLocaleTimeString()}] Executing "${script.name}"...\n`);
    setCurrentSessionId(null);

    try {
      const message = {
        type: 'execute',
        script: script.content,
        scriptName: script.name
      };

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      setOutput(prev => prev + `Error: ${error.message}\n`);
      setIsExecuting(false);
    }
  };

  const executeScript = async () => {
    if (!scriptContent.trim()) {
      alert('No script content to execute');
      return;
    }

    if (backendStatus !== 'connected') {
      alert('Backend service is not connected. Please make sure the backend is running on port 3001.');
      return;
    }

    setIsExecuting(true);
    setOutput(`[${new Date().toLocaleTimeString()}] Preparing to execute "${scriptName || 'Unnamed Script'}"...\n`);

    try {
      console.log('Sending script content:', scriptContent.substring(0, 200) + '...');
      console.log('Script name:', scriptName);
      
      const message = {
        type: 'execute',
        script: scriptContent,
        scriptName: scriptName || 'Unnamed Script'
      };

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      setOutput(prev => prev + `Error: ${error.message}\n`);
      setIsExecuting(false);
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
          <h2>PowerShell Scripts</h2>
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
            Create New Script
          </button>
        </div>
      </div>
      
      {Object.keys(scripts).length === 0 ? (
        <div className="empty-state">
          <p>No scripts found. Create your first PowerShell script!</p>
        </div>
      ) : (
        <div className={compactView ? 'script-list-compact' : 'scripts-grid'}>
          {Object.entries(scripts).map(([scriptId, script]) => (
            <div key={scriptId} className={compactView ? 'script-card-compact' : 'script-card'}>
              <div className={compactView ? 'script-info-compact' : 'script-info'}>
                <h3>{script.name}</h3>
              </div>
              {compactView ? (
                <div className="script-actions-compact">
                  <div className="tooltip-wrapper">
                    <button 
                      className="btn-icon btn-primary"
                      onClick={() => handleExecuteFromList(scriptId)}
                      disabled={isExecuting || backendStatus !== 'connected'}
                      aria-label="Execute"
                    >
                      ▶
                    </button>
                    <span className="tooltip-text">Execute</span>
                  </div>
                  <div className="tooltip-wrapper">
                    <button 
                      className="btn-icon btn-secondary"
                      onClick={() => handleSelectScript(scriptId)}
                      aria-label="Open"
                    >
                      📄
                    </button>
                    <span className="tooltip-text">Open</span>
                  </div>
                  <div className="tooltip-wrapper">
                    <button 
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteScript(scriptId)}
                      aria-label="Delete"
                    >
                      🗑
                    </button>
                    <span className="tooltip-text">Delete</span>
                  </div>
                </div>
              ) : (
                <div className="script-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleExecuteFromList(scriptId)}
                    disabled={isExecuting || backendStatus !== 'connected'}
                  >
                    Execute
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleSelectScript(scriptId)}
                  >
                    Open
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteScript(scriptId)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScriptEditor = () => (
    <div className="script-editor-view">
      <div className="view-header">
        <button 
          className="btn btn-secondary"
          onClick={() => setCurrentView('list')}
        >
          ← Back to Scripts
        </button>
        <div className="backend-status">
          <span className={`status-indicator ${backendStatus}`}>
            ● Backend: {backendStatus}
          </span>
        </div>
        <div className="header-actions">
          {!editMode && (
            <button 
              className="btn btn-secondary"
              onClick={() => setEditMode(true)}
            >
              Edit
            </button>
          )}
          {editMode && (
            <button 
              className="btn btn-primary"
              onClick={handleSaveScript}
            >
              Save Script
            </button>
          )}

          <button 
            className="btn btn-success"
            onClick={executeScript}
            disabled={isExecuting || !scriptContent.trim() || backendStatus !== 'connected'}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="script-input">
          <div className="input-group">
            <label htmlFor="scriptName">Script Name:</label>
            <input
              id="scriptName"
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              disabled={!editMode}
              placeholder="Enter script name"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="scriptContent">PowerShell Script:</label>
            <textarea
              id="scriptContent"
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              disabled={!editMode}
              placeholder="Enter your PowerShell script here..."
              rows={15}
            />
          </div>
        </div>

        {output && (
          <div className="output-section">
            <h3>Execution Status:</h3>
            <pre className="output-content">{output}</pre>
            <div className="console-info">
              <p><strong>💡 Note:</strong> Your PowerShell script is running in a separate console window. 
              This allows for interactive input and better visibility. The console window will automatically 
              close when the script completes, or you can close it manually.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="powershell-manager">
      <div className="container">
        {currentView === 'list' && renderScriptList()}
        {(currentView === 'edit' || currentView === 'create') && renderScriptEditor()}
      </div>
    </div>
  );
};

export default PowerShellManager;