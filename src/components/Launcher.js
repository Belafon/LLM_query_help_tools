import React, { useState, useEffect, useRef } from 'react';
import './Launcher.css';

const Launcher = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [scripts, setScripts] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Connect to WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Launcher connected to backend');
        ws.send(JSON.stringify({ type: 'load_data' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'load_data') {
            if (data.content && data.content['powershell-scripts']) {
              setScripts(data.content['powershell-scripts']);
            }
          }
        } catch (e) {
          console.error('Launcher WS error', e);
        }
      };

      ws.onclose = () => {
        // Reconnect logic could go here, but simple timeout is fine
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Filter scripts
  const filteredScripts = Object.entries(scripts).filter(([id, script]) => {
    const search = query.toLowerCase();
    return (script.name || '').toLowerCase().includes(search) || 
           (script.description || '').toLowerCase().includes(search);
  }).map(([id, script]) => ({ id, ...script }));

  // Handle Global Keydown
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Debug logging
      if (e.ctrlKey && e.altKey) {
        console.log('Ctrl+Alt pressed with key:', e.key);
      }

      // Ctrl + Alt + L to toggle
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') {
        console.log('Toggling Launcher');
        e.preventDefault();
        setIsVisible(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      
      // Escape to close
      if (isVisible && e.key === 'Escape') {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isVisible]);

  // Focus input when visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Ensure selected index is valid when list changes
  useEffect(() => {
    if (selectedIndex >= filteredScripts.length && filteredScripts.length > 0) {
      setSelectedIndex(filteredScripts.length - 1);
    }
  }, [filteredScripts.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (isVisible && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isVisible]);

  // Handle navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredScripts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeScript();
    }
  };

  const executeScript = () => {
    if (filteredScripts[selectedIndex]) {
      const script = filteredScripts[selectedIndex];
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'execute',
          scriptId: script.id,
          script: script.content, // Changed from script.script to script.content
          scriptName: script.name,
          restoreFocus: true 
        }));
      }
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="launcher-overlay" onClick={() => setIsVisible(false)}>
      <div className="launcher-container" onClick={e => e.stopPropagation()}>
        <div className="launcher-input-wrapper">
          <input
            ref={inputRef}
            className="launcher-input"
            placeholder="Type to search scripts..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="launcher-results" ref={resultsRef}>
          {filteredScripts.map((script, index) => (
            <div
              key={script.id}
              className={`launcher-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => { setSelectedIndex(index); executeScript(); }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="launcher-item-name">{script.name}</span>
              {script.description && <span className="launcher-item-desc">{script.description}</span>}
            </div>
          ))}
          {filteredScripts.length === 0 && (
            <div className="launcher-item">No scripts found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Launcher;
