import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SelfHealingErrorBoundary } from './components/SelfHealingErrorBoundary.tsx';

// Suppress benign Vite websocket errors to prevent AI Studio error overlay
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[vite]')) return;
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SelfHealingErrorBoundary>
      <App />
    </SelfHealingErrorBoundary>
  </StrictMode>,
);
