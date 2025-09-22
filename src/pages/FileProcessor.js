import React, { useState } from 'react';
import './FileProcessor.css';

const FileProcessor = () => {
  const [droppedItems, setDroppedItems] = useState([]);
  const [processedContent, setProcessedContent] = useState('');
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

    let allContent = '';
    
    for (const item of droppedItems) {
      try {
        const content = await processFileEntry(item);
        allContent += content;
      } catch (error) {
        console.error('Error processing file:', error);
        allContent += `Error processing ${item.name}: ${error.message}\n\n`;
      }
    }

    setProcessedContent(allContent);
    setIsProcessing(false);
  };

  const clearFiles = () => {
    setDroppedItems([]);
    setProcessedContent('');
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

      {droppedItems.length > 0 && (
        <div className="dropped-items">
          <h3>Dropped Items ({droppedItems.length}):</h3>
          <ul>
            {droppedItems.map((item, index) => (
              <li key={index}>
                {item.isDirectory ? '📁' : '📄'} {item.name}
              </li>
            ))}
          </ul>
          
          <div className="action-buttons">
            <button 
              onClick={processAllFiles}
              disabled={isProcessing}
              className="process-btn"
            >
              {isProcessing ? 'Processing...' : 'Process All Files'}
            </button>
            <button onClick={clearFiles} className="clear-btn">
              Clear Files
            </button>
          </div>
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