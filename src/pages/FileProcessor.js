import React, { useState } from 'react';
import './FileProcessor.css';

const FileProcessor = () => {
  const [droppedItems, setDroppedItems] = useState([]);
  const [customPaths, setCustomPaths] = useState('');
  const [processedContent, setProcessedContent] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const items = e.dataTransfer.items;
    const newItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          newItems.push(entry);
        }
      }
    }

    setDroppedItems(prev => [...prev, ...newItems]);
  };

  const processFileEntry = async (entry, basePath = '') => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const filePath = basePath + entry.name;
            const fileContent = e.target.result;
            const formattedContent = `
=== FILE START: ${filePath} ===
${fileContent}
=== FILE END: ${filePath} ===

`;
            resolve(formattedContent);
          };
          reader.readAsText(file);
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        dirReader.readEntries(async (entries) => {
          let directoryContent = '';
          for (const subEntry of entries) {
            const subContent = await processFileEntry(subEntry, basePath + entry.name + '/');
            directoryContent += subContent;
          }
          resolve(directoryContent);
        });
      }
    });
  };

  const processAllFiles = async () => {
    setIsProcessing(true);
    setProcessedContent('');
    setWarnings([]);

    let allContent = '';
    let currentWarnings = [];
    
    // Process dropped items
    for (const item of droppedItems) {
      try {
        const content = await processFileEntry(item);
        allContent += content;
      } catch (error) {
        console.error('Error processing file:', error);
        currentWarnings.push(`Error processing ${item.name}: ${error.message}`);
      }
    }

    // Process custom paths
    // Split by newlines first, then try to handle space-separated paths that look like Windows paths
    const rawLines = customPaths.split('\n');
    let pathsArray = [];
    
    rawLines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // If a line contains multiple Windows-style paths (C:\...) separated by spaces
      // but only if those spaces aren't inside the path itself.
      // We look for patterns like " C:\" or " D:\" as potential separators
      const parts = trimmedLine.split(/\s+(?=[a-zA-Z]:\\)/);
      pathsArray.push(...parts.map(p => p.trim()).filter(p => p !== ''));
    });

    if (pathsArray.length > 0) {
      try {
        const backendHost = window.location.hostname || '127.0.0.1';
        const response = await fetch(`http://${backendHost}:3001/api/read-files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paths: pathsArray }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 404) {
            throw new Error('Backend route not found (404). Please restart your backend server (npm run dev) to apply new changes.');
          }
          throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        
        if (data.results) {
          data.results.forEach(result => {
            if (result.success) {
              allContent += `
=== FILE START: ${result.path} ===
${result.content}
=== FILE END: ${result.path} ===

`;
            } else {
              // Add non-existent files to warnings state instead of content
              if (result.error && result.error.includes('not found')) {
                currentWarnings.push(`File not found: ${result.path}`);
              } else {
                currentWarnings.push(`${result.path}: ${result.error}`);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error fetching custom paths:', error);
        currentWarnings.push(`Error connecting to backend for custom paths: ${error.message}`);
      }
    }

    setProcessedContent(allContent);
    setWarnings(currentWarnings);
    setIsProcessing(false);
  };

  const clearFiles = () => {
    setDroppedItems([]);
    setCustomPaths('');
    setProcessedContent('');
    setWarnings([]);
  };

  const downloadResult = () => {
    const element = document.createElement('a');
    const file = new Blob([processedContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'processed_files.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(processedContent);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = processedContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="file-processor">
      <h1>File & Folder Processor</h1>
      
      <div 
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <p>Drag and drop files or folders here</p>
          <p className="drop-zone-subtitle">All files will be processed recursively</p>
        </div>
      </div>

      <div className="custom-paths-section">
        <h3>Custom File Paths:</h3>
        <p className="section-subtitle">Enter absolute paths to files, each on a new line</p>
        <textarea
          className="custom-paths-textarea"
          value={customPaths}
          onChange={(e) => setCustomPaths(e.target.value)}
          placeholder="C:\path\to\file1.txt&#10;C:\path\to\file2.js"
        />
      </div>

      {(droppedItems.length > 0 || customPaths.trim().length > 0) && (
        <div className="dropped-items">
          {droppedItems.length > 0 && (
            <>
              <h3>Dropped Items ({droppedItems.length}):</h3>
              <ul>
                {droppedItems.map((item, index) => (
                  <li key={index}>
                    {item.isDirectory ? '📁' : '📄'} {item.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          
          <div className="action-buttons">
            <button 
              onClick={processAllFiles}
              disabled={isProcessing}
              className="process-btn"
            >
              {isProcessing ? 'Processing...' : 'Process All Files'}
            </button>
            <button onClick={clearFiles} className="clear-btn">
              Clear All
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="warnings-section">
          <h3>⚠️ Warnings ({warnings.length})</h3>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {processedContent && (
        <div className="result-section">
          <div className="result-header">
            <h3>Processed Content:</h3>
            <div className="result-buttons">
              <button onClick={copyToClipboard} className="copy-btn">
                Copy to Clipboard
              </button>
              <button onClick={downloadResult} className="download-btn">
                Download Result
              </button>
            </div>
          </div>
          <textarea
            className="result-textarea"
            value={processedContent}
            onChange={(e) => setProcessedContent(e.target.value)}
            placeholder="Processed file contents will appear here..."
          />
        </div>
      )}
    </div>
  );
};

export default FileProcessor;