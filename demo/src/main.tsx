import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConsentProvider } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import 'consent-kit/ui.css';
import './demo.css';
import { consentConfig } from './consent.config';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentProvider config={consentConfig}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ConsentUI owner="Muster GmbH (Demo)" />
    </ConsentProvider>
  </StrictMode>,
);
