import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PathManager.css';

const PathManager = () => {
  const [paths, setPaths] = useState([]);
  const [newAlias, setNewAlias] = useState('');
  const [newPath, setNewPath] = useState('');
  const [currentWorkspace, setCurrentWorkspace] = useState('Default');
  const [workspaces, setWorkspaces] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [editingAlias, setEditingAlias] = useState(null);
  const [editValue, setEditValue] = useState('');
  const wsRef = useRef(null);

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const connectToBackend = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Path Manager backend');
        setBackendStatus('connected');
        ws.send(JSON.stringify({ type: 'load_data' }));
        ws.send(JSON.stringify({ type: 'list_workspaces' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'load_data') {
          setPaths(data.content.paths || []);
          setCurrentWorkspace(data.workspace || 'Default');
        } else if (data.type === 'workspace_list') {
          setWorkspaces(data.workspaces || []);
          if (data.current) {
            setCurrentWorkspace(data.current);
          }
        } else if (data.type === 'workspace_switched') {
          setCurrentWorkspace(data.workspace);
          // Reload data for the new workspace
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'load_data' }));
          }
        } else if (data.type === 'global_paths') {
          setPaths(data.paths || []);
        } else if (data.type === 'alias_renamed') {
          showStatus('success', data.message);
          setEditingAlias(null);
        } else if (data.type === 'save_success' && data.dataType === 'paths') {
          showStatus('success', 'Paths saved successfully');
        } else if (data.type === 'error') {
          showStatus('error', data.message);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from Path Manager backend');
        setBackendStatus('disconnected');
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
  }, []);

  useEffect(() => {
    connectToBackend();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectToBackend]);

  const saveData = (updatedPaths) => {
    if (backendStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'save_data',
        dataType: 'paths',
        content: updatedPaths
      }));
    } else {
      showStatus('error', 'Not connected to backend');
    }
  };

  const handleAddPath = (e) => {
    e.preventDefault();
    if (!newAlias || !newPath) {
      showStatus('error', 'Both alias and path are required');
      return;
    }

    const cleanAlias = newAlias.replace(/[{}]/g, '').toUpperCase();
    
    if (paths.some(p => p.alias === cleanAlias)) {
      showStatus('error', 'Alias already exists');
      return;
    }

    const updatedPaths = [...paths, { alias: cleanAlias, path: newPath }];
    setPaths(updatedPaths);
    setNewAlias('');
    setNewPath('');
    saveData(updatedPaths);
  };

  const handleDeletePath = (alias) => {
    const updatedPaths = paths.filter(p => p.alias !== alias);
    setPaths(updatedPaths);
    saveData(updatedPaths);
  };

  const handleStartRename = (alias) => {
    setEditingAlias(alias);
    setEditValue(alias);
  };

  const handleCancelRename = () => {
    setEditingAlias(null);
    setEditValue('');
  };

  const handleConfirmRename = (oldAlias) => {
    const cleanNewAlias = editValue.replace(/[{}]/g, '').toUpperCase();
    
    if (!cleanNewAlias) {
      showStatus('error', 'Alias name cannot be empty');
      return;
    }

    if (cleanNewAlias === oldAlias) {
      setEditingAlias(null);
      return;
    }

    if (paths.some(p => p.alias === cleanNewAlias)) {
      showStatus('error', 'Alias already exists');
      return;
    }

    if (backendStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'rename_path_alias',
        oldAlias,
        newAlias: cleanNewAlias
      }));
    } else {
      showStatus('error', 'Not connected to backend');
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

  return (
    <div className="path-manager-container">
      <div className="path-manager-header">
        <h1>Path Manager</h1>
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

      {status.message && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <div className="path-manager-info">
        <p>Define aliases for long file paths. Use them in your scripts as <code>{"{{ALIAS}}"}</code>.</p>
        <p>Example: Alias <code>DOCS</code> for <code>C:\Users\Name\Documents</code> becomes <code>{"{{DOCS}}"}</code> in scripts.</p>
      </div>

      <form className="add-path-form" onSubmit={handleAddPath}>
        <div className="form-group">
          <label>Alias Name</label>
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="e.g. DOCS"
          />
        </div>
        <div className="form-group">
          <label>Actual Windows Path</label>
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="C:\Path\To\Folder"
          />
        </div>
        <button type="submit" className="add-btn">Add Alias</button>
      </form>

      <div className="paths-list">
        <h2>Configured Aliases</h2>
        {paths.length === 0 ? (
          <p className="no-paths">No aliases configured for this workspace.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Alias</th>
                <th>Usage</th>
                <th>Target Path</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paths.map((p) => (
                <tr key={p.alias}>
                  <td className="alias-cell" data-label="Alias">
                    {editingAlias === p.alias ? (
                      <input
                        type="text"
                        className="edit-alias-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      p.alias
                    )}
                  </td>
                  <td className="usage-cell" data-label="Usage"><code>{"{{"}{p.alias}{"}}"}</code></td>
                  <td className="path-cell" data-label="Target Path">{p.path}</td>
                  <td className="actions-cell" data-label="Actions">
                    {editingAlias === p.alias ? (
                      <>
                        <button 
                          className="save-btn"
                          onClick={() => handleConfirmRename(p.alias)}
                        >
                          Save
                        </button>
                        <button 
                          className="cancel-btn"
                          onClick={handleCancelRename}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="edit-btn"
                          onClick={() => handleStartRename(p.alias)}
                        >
                          Rename
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeletePath(p.alias)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PathManager;
