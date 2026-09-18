import { useCallback, useEffect, useState, type RefObject } from 'react';

// Only the current key counts: an older build could write 'morya.immersiveHintDismissed' on automatic hide.
const HINT_KEY = 'morya.immersiveHintDismissed.v1';

function isHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setHintDismissed(): void {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

function detectFullscreenSupport(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenEnabled &&
    typeof document.exitFullscreen === 'function' &&
    (typeof document.documentElement.requestFullscreen === 'function' ||
      (typeof Element !== 'undefined' && typeof Element.prototype.requestFullscreen === 'function'))
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isMediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  const isMediaFullscreen = window.matchMedia?.('(display-mode: fullscreen)').matches === true;
  const isNavigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return isMediaStandalone || isMediaFullscreen || isNavigatorStandalone;
}

interface Props {
  root: RefObject<HTMLElement | null>;
  hidden?: boolean;
  quiet?: boolean;
}

export function ImmersiveToggle({ root, hidden = false, quiet = false }: Props) {
  const [fullscreen, setFullscreen] = useState(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(document.fullscreenElement);
  });
  const [hint, setHint] = useState(false);
  const [dismissed, setDismissed] = useState(isHintDismissed);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [standaloneQuery, setStandaloneQuery] = useState(isStandalone);

  const supported = detectFullscreenSupport();
  const canFullscreen = supported && !sessionFailed;
  const standalone = isStandalone() || standaloneQuery;

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('fullscreenerror', change);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('fullscreenerror', change);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const onChange = () => setStandaloneQuery(isStandalone());
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  // Explicit dismissal via × permanently dismisses the hint for this device
  const dismissExplicit = useCallback(() => {
    setHint(false);
    setHintDismissed();
    setDismissed(true);
  }, []);

  // Auto-dismiss timeout ONLY hides the current hint; does NOT persist dismissal
  const dismissTimeout = useCallback(() => {
    setHint(false);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(dismissTimeout, 7000);
    return () => window.clearTimeout(id);
  }, [hint, dismissTimeout]);

  const toggle = async () => {
    if (canFullscreen) {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }
        const target = root.current ?? document.documentElement;
        if (target && typeof target.requestFullscreen === 'function') {
          try {
            // 1. First attempt with navigationUI: 'hide'
            await target.requestFullscreen({ navigationUI: 'hide' });
            return;
          } catch {
            // 2. Retry plain requestFullscreen() if options or path rejected
            try {
              await target.requestFullscreen();
              return;
            } catch {
              // 3. Complete failure: mark session as failed and show fallback hint
              setSessionFailed(true);
              setHint(true);
              return;
            }
          }
        }
      } catch {
        // Fail gracefully without noisy errors or interrupting the artwork
      }
      return;
    }

    if (standalone) return;

    // If hint is already visible, tapping again toggles it off
    if (hint) {
      setHint(false);
      return;
    }

    // Fallback path: show hint unless already explicitly dismissed
    if (isHintDismissed()) return;
    setHint(true);
  };

  // without fullscreen, the hint is the control's only purpose; once she has put it away there is nothing left to offer
  if (hidden || standalone || (!canFullscreen && dismissed && !hint)) return null;

  const ariaLabel = canFullscreen
    ? (fullscreen ? 'Exit full screen' : 'Enter full screen')
    : 'Immersive viewing options';

  return (
    <>
      <button
        className={`immersive ${quiet ? 'is-quiet' : ''}`}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-pressed={canFullscreen ? fullscreen : undefined}
        aria-expanded={!canFullscreen ? hint : undefined}
      >
        {fullscreen ? (
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" /></svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H3v5M12 3h5v5M8 17H3v-5M12 17h5v-5" /></svg>
        )}
      </button>
      {hint && (
        <aside className="immersive-hint" aria-live="polite">
          <button type="button" onClick={dismissExplicit} aria-label="Dismiss immersive view hint">×</button>
          <div className="immersive-hint-text">
            <span className="immersive-hint-title">For the most immersive view</span>
            <span className="immersive-hint-step">Share → Add to Home Screen</span>
          </div>
        </aside>
      )}
    </>
  );
}
