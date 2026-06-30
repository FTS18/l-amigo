import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardApp } from './DashboardApp';
import { ErrorBoundary } from '../popup/ErrorBoundary';
import '../popup/App.css';
import '../popup/styles/chrome.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <DashboardApp />
    </ErrorBoundary>
  </React.StrictMode>
);
