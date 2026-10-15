import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (navigator.storage?.persist) {
  navigator.storage.persist().then((granted) => {
    console.log('Persistent storage:', granted);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
