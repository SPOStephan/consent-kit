import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConsentProvider } from 'consent-kit/react';
import { ConsentUI } from 'consent-kit/ui';
import 'consent-kit/ui.css';
import './demo.css';
import { consentConfig } from './consent.config';
import type { RemoteOptions } from 'consent-kit/remote';

// Nur für die automatischen Tests: Einstellungen aus einem (simulierten) Backend laden.
const testRemote = (globalThis as { __DEMO_REMOTE__?: RemoteOptions }).__DEMO_REMOTE__;
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentProvider {...(testRemote ? { remote: testRemote } : { config: consentConfig })}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ConsentUI owner="Muster GmbH (Demo)" />
    </ConsentProvider>
  </StrictMode>,
);
