import React, { useState, useEffect, useRef } from 'react';
import { WEBSOCKET_URL } from '../config/backend';
import './WorkspaceManager.css';

const WorkspaceManager = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const wsRef = useRef(null);

  const connectToBackend = () => {
    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setBackendStatus('connected');
        ws.send(JSON.stringify({ type: 'list_workspaces' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'workspace_list') {
          setWorkspaces(data.workspaces);
          setCurrentWorkspace(data.current);
        } else if (data.type === 'workspace_switched') {
          setCurrentWorkspace(data.workspace);
        }
      };

      ws.onclose = () => {
        setBackendStatus('disconnected');
        setTimeout(connectToBackend, 3000);
      };
    } catch (error) {
      setBackendStatus('error');
    }
  };

  useEffect(() => {
    connectToBackend();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateWorkspace = (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'create_workspace',
      name: newWorkspaceName.trim()
    }));
    setNewWorkspaceName('');
  };

  const handleSwitchWorkspace = (name) => {
    wsRef.current.send(JSON.stringify({
      type: 'switch_workspace',
      name
    }));
  };

  const handleDeleteWorkspace = (name) => {
    if (name === 'Default') {
      alert('Cannot delete the Default workspace');
      return;
    }
    if (window.confirm(`Are you sure you want to delete workspace "${name}"?`)) {
      wsRef.current.send(JSON.stringify({
        type: 'delete_workspace',
        name
      }));
    }
  };

  return (
    <div className="workspace-manager">
      <div className="container">
        <div className="view-header">
          <h1>Workspace Manager</h1>
          <div className="backend-status">
            <span className={`status-indicator ${backendStatus}`}>
              â— Backend: {backendStatus}
            </span>
          </div>
        </div>

        <div className="create-section">
          <form onSubmit={handleCreateWorkspace} className="create-form">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="New workspace name..."
              className="workspace-input"
            />
            <button type="submit" className="btn btn-primary">Create Workspace</button>
          </form>
        </div>

        <div className="workspace-grid">
          {workspaces.map((ws) => (
            <div key={ws} className={`workspace-card ${ws === currentWorkspace ? 'active' : ''}`}>
              <div className="workspace-info">
                <h3>{ws}</h3>
                {ws === currentWorkspace && <span className="active-badge">Active</span>}
              </div>
              <div className="workspace-actions">
                {ws !== currentWorkspace && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleSwitchWorkspace(ws)}
                  >
                    Switch
                  </button>
                )}
                {ws !== 'Default' && (
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteWorkspace(ws)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceManager;
