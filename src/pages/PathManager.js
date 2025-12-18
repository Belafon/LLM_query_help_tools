import React, { useState, useEffect, useCallback } from 'react';
import './PathManager.css';

const PathManager = () => {
  const [paths, setPaths] = useState([]);
  const [newAlias, setNewAlias] = useState('');
  const [newPath, setNewPath] = useState('');
  const [currentWorkspace, setCurrentWorkspace] = useState('Default');
  const [status, setStatus] = useState({ type: '', message: '' });

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/load-data');
      const data = await response.json();
      
      if (data.success) {
        setPaths(data.data.paths || []);
        setCurrentWorkspace(data.workspace || 'Default');
      }
    } catch (error) {
      console.error('Error loading paths:', error);
      showStatus('error', 'Failed to load paths');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveData = async (updatedPaths) => {
    try {
      // First get current data to preserve scripts
      const response = await fetch('http://localhost:3001/api/load-data');
      const currentData = await response.json();
      
      const payload = {
        ...currentData.data,
        paths: updatedPaths
      };

      const saveResponse = await fetch('http://localhost:3001/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await saveResponse.json();
      if (result.success) {
        showStatus('success', 'Paths saved successfully');
      } else {
        showStatus('error', result.message || 'Failed to save paths');
      }
    } catch (error) {
      console.error('Error saving paths:', error);
      showStatus('error', 'Failed to save paths');
    }
  };

  const handleAddPath = (e) => {
    e.preventDefault();
    if (!newAlias || !newPath) {
      showStatus('error', 'Both alias and path are required');
      return;
    }

    // Clean alias (remove {{ }} if user added them)
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

  return (
    <div className="path-manager-container">
      <div className="path-manager-header">
        <h1>Path Manager</h1>
        <div className="workspace-badge">Workspace: {currentWorkspace}</div>
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
                  <td className="alias-cell">{p.alias}</td>
                  <td className="usage-cell"><code>{"{{"}{p.alias}{"}}"}</code></td>
                  <td className="path-cell">{p.path}</td>
                  <td>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeletePath(p.alias)}
                    >
                      Delete
                    </button>
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
