import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ pages }) => {
  const location = useLocation();
  const [isCompact, setIsCompact] = useState(true);

  // Icon mapping for each page
  const getPageIcon = (pageName) => {
    const iconMap = {
      'File Processor': '📄',
      'PowerShell Manager': '⚡',
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
    </div>
  );
};

export default Sidebar;