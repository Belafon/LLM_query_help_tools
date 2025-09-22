import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ pages }) => {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Pages</h2>
      </div>
      <nav className="sidebar-nav">
        <ul className="page-list">
          {pages.map((page) => (
            <li key={page.path} className="page-item">
              <Link
                to={page.path}
                className={`page-link ${location.pathname === page.path ? 'active' : ''}`}
              >
                <span className="page-name">{page.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;