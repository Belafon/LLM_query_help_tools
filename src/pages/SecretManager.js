import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WEBSOCKET_URL } from '../config/backend';
import './SecretManager.css';

const SecretManager = () => {
  const [secrets, setSecrets] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showValues, setShowValues] = useState({});
  const wsRef = useRef(null);

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const connectToBackend = useCallback(() => {
    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Secret Manager backend');
        setBackendStatus('connected');
        ws.send(JSON.stringify({ type: 'load_secrets' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'secrets_data') {
          setSecrets(data.secrets || []);
        } else if (data.type === 'secret_saved') {
          showStatus('success', data.message);
          ws.send(JSON.stringify({ type: 'load_secrets' }));
        } else if (data.type === 'secret_deleted') {
          showStatus('success', data.message);
          ws.send(JSON.stringify({ type: 'load_secrets' }));
        } else if (data.type === 'secret_key_added') {
          showStatus('success', data.message);
          ws.send(JSON.stringify({ type: 'load_secrets' }));
        } else if (data.type === 'error') {
          showStatus('error', data.message);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from Secret Manager backend');
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

  const handleAddKey = (e) => {
    e.preventDefault();
    if (!newKey) {
      showStatus('error', 'Secret key name is required');
      return;
    }

    const cleanKey = newKey.replace(/[{}]/g, '').toUpperCase().replace(/\s+/g, '_');

    if (secrets.some(s => s.key === cleanKey)) {
      showStatus('error', 'Secret key already exists');
      return;
    }

    if (backendStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'add_secret_key',
        key: cleanKey,
        description: newDescription || ''
      }));
      setNewKey('');
      setNewDescription('');
    } else {
      showStatus('error', 'Not connected to backend');
    }
  };

  const handleDeleteKey = (key) => {
    if (backendStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'delete_secret_key',
        key: key
      }));
    } else {
      showStatus('error', 'Not connected to backend');
    }
  };

  const handleStartEdit = (secret) => {
    setEditingKey(secret.key);
    setEditValue(secret.value || '');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSaveValue = (key) => {
    if (backendStatus === 'connected' && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'save_secret_value',
        key: key,
        value: editValue
      }));
      setEditingKey(null);
      setEditValue('');
    } else {
      showStatus('error', 'Not connected to backend');
    }
  };

  const toggleShowValue = (key) => {
    setShowValues(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const maskValue = (value) => {
    if (!value) return '(not set)';
    return '*'.repeat(Math.min(value.length, 20));
  };

  return (
    <div className="secret-manager-container">
      <div className="secret-manager-header">
        <h1>Secret Manager</h1>
        <div className={`backend-status ${backendStatus}`}>
          {backendStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {status.message && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <div className="secret-manager-info">
        <p>Store sensitive values like API keys and passwords securely. Use them in your scripts as <code>{"{{SECRET_KEY}}"}</code>.</p>
        <p><strong>Note:</strong> Secret key names are stored in git (visible to others), but the actual values are stored locally and never committed.</p>
      </div>

      <form className="add-secret-form" onSubmit={handleAddKey}>
        <div className="form-group">
          <label>Secret Key Name</label>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g. API_TOKEN"
          />
        </div>
        <div className="form-group">
          <label>Description (optional)</label>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="What is this secret for?"
          />
        </div>
        <button type="submit" className="add-btn">Add Secret Key</button>
      </form>

      <div className="secrets-list">
        <h2>Configured Secrets</h2>
        {secrets.length === 0 ? (
          <p className="no-secrets">No secrets configured yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Usage</th>
                <th>Value</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((secret) => (
                <tr key={secret.key} className={!secret.value ? 'empty-value' : ''}>
                  <td className="key-cell" data-label="Key Name">{secret.key}</td>
                  <td className="usage-cell" data-label="Usage"><code>{"{{"}{secret.key}{"}}"}</code></td>
                  <td className="value-cell" data-label="Value">
                    {editingKey === secret.key ? (
                      <input
                        type="text"
                        className="edit-value-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Enter secret value"
                        autoFocus
                      />
                    ) : (
                      <span className="value-display">
                        {showValues[secret.key] ? (secret.value || '(not set)') : maskValue(secret.value)}
                        {secret.value && (
                          <button
                            className="toggle-visibility-btn"
                            onClick={() => toggleShowValue(secret.key)}
                            title={showValues[secret.key] ? 'Hide' : 'Show'}
                          >
                            {showValues[secret.key] ? '🙈' : '👁️'}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="description-cell" data-label="Description">{secret.description || '-'}</td>
                  <td className="actions-cell" data-label="Actions">
                    {editingKey === secret.key ? (
                      <>
                        <button
                          className="save-btn"
                          onClick={() => handleSaveValue(secret.key)}
                        >
                          Save
                        </button>
                        <button
                          className="cancel-btn"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="edit-btn"
                          onClick={() => handleStartEdit(secret)}
                        >
                          {secret.value ? 'Edit' : 'Set Value'}
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteKey(secret.key)}
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

export default SecretManager;
