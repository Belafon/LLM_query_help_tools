import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import pageRegistry from './config/pageRegistry';

function App() {
  return (
    <Router>
      <div className="App">
        <Sidebar pages={pageRegistry} />
        <main className="main-content">
          <Routes>
            {pageRegistry.map((page) => (
              <Route
                key={page.path}
                path={page.path}
                element={<page.component />}
              />
            ))}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
