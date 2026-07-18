import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { DesignWindow } from './DesignWindow.js';
import { ErrorBoundary } from './components/primitives/ErrorBoundary.js';
import './theme.css';

// main.ts opens the Design Studio as its own window with #design in the URL.
// Reading it here rather than inside App keeps the studio window from mounting
// the chat/track machinery it will never show.
const isDesignWindow = window.location.hash.replace(/^#/, '') === 'design';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isDesignWindow ? <DesignWindow /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);
