import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/globals.css';
import './styles/tokens.css';
import App from './App';
import { AppearanceProvider } from './lib/AppearanceContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>
);

reportWebVitals();
