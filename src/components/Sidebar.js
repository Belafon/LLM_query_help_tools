import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ pages }) => {
  const location = useLocation();
  const [isCompact, setIsCompact] = useState(true);
  const [currentWorkspace, setCurrentWorkspace] = useState('Default');
  const wsRef = useRef(null);

  const connectToBackend = () => {
    try {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'load_data' }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'load_data' && data.workspace) {
          setCurrentWorkspace(data.workspace);
        } else if (data.type === 'workspace_switched') {
          setCurrentWorkspace(data.workspace);
        }
      };

      ws.onclose = () => {
        setTimeout(connectToBackend, 3000);
      };
    } catch (error) {
      console.error('Sidebar WS error:', error);
    }
  };

  useEffect(() => {
    connectToBackend();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Icon mapping for each page
  const getPageIcon = (pageName) => {
    const iconMap = {
      'File Processor': '📄',
      'PowerShell Manager': '⚡',
      'Hotkey Manager': '⌨️',
      'Workspaces': '📁',
      'Path Manager': '🔗',
      'Settings': '⚙️',
      // Add more icons as you add more pages
    };
    return iconMap[pageName] || '📋';
  };

  // Update CSS variable when compact state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCompact ? '50px' : '250px'
    );
  }, [isCompact]);

  return (
    <div className={`sidebar ${isCompact ? 'sidebar-compact' : ''}`}>
      <div className="sidebar-header">
        {!isCompact && <h2>Pages</h2>}
        <button
          className="sidebar-toggle"
          onClick={() => setIsCompact(!isCompact)}
          title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCompact ? '→' : '←'}
        </button>
      </div>
      <nav className="sidebar-nav">
        <ul className="page-list">
          {pages.map((page) => (
            <li key={page.path} className="page-item">
              <Link
                to={page.path}
                className={`page-link ${location.pathname === page.path ? 'active' : ''}`}
              >
                <span className="page-icon">{getPageIcon(page.name)}</span>
                {!isCompact && <span className="page-name">{page.name}</span>}
                {isCompact && <span className="page-tooltip">{page.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        {!isCompact && <span className="workspace-label">Workspace:</span>}
        <span className="workspace-name" title={`Current Workspace: ${currentWorkspace}`}>
          {isCompact ? currentWorkspace.charAt(0) : currentWorkspace}
        </span>
      </div>
    </div>
  );
};

export default Sidebar;