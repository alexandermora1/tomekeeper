import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts are self-hosted (SIL Open Font License), so no reader data goes to a font service.
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/400-italic.css';
import '@fontsource/alegreya/500.css';
import '@fontsource/alegreya/500-italic.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya-sc/500.css';
import '@fontsource/alegreya-sc/700.css';
import '@fontsource/grenze-gotisch/500.css';
import '@fontsource/grenze-gotisch/700.css';

import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
