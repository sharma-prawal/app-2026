import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import './styles.css';

const root = document.getElementById('root')!;
if (import.meta.env.DEV && new URLSearchParams(location.search).has('art')) {
  import('./debug').then((m) => m.renderArtDebug(root));
} else {
  if (import.meta.env.DEV) void import('./devtools');
  import('./App').then(({ App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
