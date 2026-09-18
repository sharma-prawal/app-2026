import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Engine, type UIState } from './engine/Engine';
import { Threshold } from './ui/Threshold';
import { SoundToggle } from './ui/SoundToggle';
import { FoldedPatra, PatraSheet } from './ui/Patra';
import { ImmersiveToggle } from './ui/ImmersiveToggle';
import { MEMORIES } from './art/layout';

/** How long taps must stop before another memory action is accepted. */
const MEMORY_QUIET_MS = 700;
/** How long the requested film may take to become playable before the ending continues without it. */
const EPILOGUE_STALL_MS = 9000;

export function App() {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ui, setUi] = useState<UIState | null>(null);
  const [thresholdKey, setThresholdKey] = useState(0);
  const [showThreshold, setShowThreshold] = useState(true);
  const [epilogue, setEpilogue] = useState<'idle' | 'playing' | 'leaving' | 'done'>('idle');
  const epilogueRef = useRef<'idle' | 'playing' | 'leaving' | 'done'>('idle');
  const [videoFailed, setVideoFailed] = useState(false);
  /** The film is fetched once per sitting; a later re-render must not reload (and discard) what is buffered. */
  const epiloguePreparedRef = useRef(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas, (next) => setUi(next));
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __morya: Engine }).__morya = engine;
    setUi(engine.ui);
    const measure = () => {
      const cs = getComputedStyle(probeRef.current!);
      engine.setInsets({
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
      });
    };
    measure();
    void engine.start();
    window.addEventListener('orientationchange', measure);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('resize', measure);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const phase = ui?.phase ?? 'threshold';

  // The threshold leaves slowly after the lamp is lit, and returns on replay.
  useEffect(() => {
    if (phase === 'threshold') {
      setShowThreshold(true);
      return;
    }
    const id = window.setTimeout(() => setShowThreshold(false), 1800);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      if (engineRef.current?.key(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const light = useCallback(() => engineRef.current?.lightDiya(), []);

  // Navigation lock refs and state for memory transitions
  const navigationLockedRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const unlockTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const lastMemoryIdRef = useRef<string | null>(null);
  // One burst of taps or swipes is one action: every attempt, accepted or not, restarts the quiet period,
  // so a continuous stream can never become a second step (or "And one more thing.") once a transition ends.
  // Touches are judged by when the finger came down (event.timeStamp), not when a busy main thread handles them,
  // so taps queued behind a memory opening still count as one unbroken burst.
  const lastMemoryActivationAttemptRef = useRef(-Infinity);
  const noteMemoryAttempt = useCallback((at: number) => {
    const sinceLastAttempt = at - lastMemoryActivationAttemptRef.current;
    lastMemoryActivationAttemptRef.current = Math.max(lastMemoryActivationAttemptRef.current, at);
    return sinceLastAttempt >= MEMORY_QUIET_MS;
  }, []);
  /** The touch in progress in the memory viewer, judged once as it came down. */
  const memoryGesture = useRef<{ x: number; y: number; t: number; allowed: boolean; used: boolean } | null>(null);
  /** A tap's verdict was decided at touch-down; keyboard or assistive activation, with no fresh touch, is judged now. */
  const takeMemoryActivation = useCallback(() => {
    const g = memoryGesture.current;
    if (g && !g.used && performance.now() - g.t < 1500) {
      g.used = true;
      return g.allowed;
    }
    return noteMemoryAttempt(performance.now());
  }, [noteMemoryAttempt]);

  const clearNavTimers = useCallback(() => {
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const unlockNavigation = useCallback(() => {
    clearNavTimers();
    navigationLockedRef.current = false;
    setIsNavigating(false);
  }, [clearNavTimers]);

  const armSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
    }
    safetyTimerRef.current = window.setTimeout(() => {
      safetyTimerRef.current = null;
      navigationLockedRef.current = false;
      setIsNavigating(false);
    }, 3000);
  }, []);

  const replay = useCallback(() => {
    unlockNavigation();
    lastMemoryActivationAttemptRef.current = -Infinity;
    epiloguePreparedRef.current = false;
    epilogueRef.current = 'idle';
    setEpilogue('idle');
    setVideoFailed(false);
    engineRef.current?.replay();
    window.setTimeout(() => setThresholdKey((k) => k + 1), 1000);
  }, [unlockNavigation]);

  const openLetter = useCallback(() => engineRef.current?.openLetter(), []);
  // the note folds back along its creases before it is put away for good
  const [folding, setFolding] = useState(false);
  const foldLetter = useCallback(() => {
    if (folding) return;
    setFolding(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      engineRef.current?.closeLetter();
      setFolding(false);
    }, reduced ? 0 : 950);
  }, [folding]);

  const backToPainting = useCallback(() => {
    unlockNavigation();
    lastMemoryActivationAttemptRef.current = -Infinity;
    engineRef.current?.closeMemory();
  }, [unlockNavigation]);

  const triggerMemoryNav = useCallback((step: number, allowed: boolean) => {
    if (!allowed || navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    setIsNavigating(true);
    const started = engineRef.current?.navigateMemory(step);
    if (!started) {
      navigationLockedRef.current = false;
      setIsNavigating(false);
      return;
    }
    armSafetyTimer();
  }, [armSafetyTimer]);

  const nextMemory = useCallback(() => {
    triggerMemoryNav(1, takeMemoryActivation());
  }, [takeMemoryActivation, triggerMemoryNav]);

  const finishMemories = useCallback((allowed: boolean) => {
    if (!allowed || navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    setIsNavigating(true);
    const started = engineRef.current?.finishMemories();
    if (!started) {
      navigationLockedRef.current = false;
      setIsNavigating(false);
      return;
    }
    armSafetyTimer();
  }, [armSafetyTimer]);
  const finishMemoriesByTap = useCallback(() => finishMemories(takeMemoryActivation()), [finishMemories, takeMemoryActivation]);

  const whisper = ui?.whisper ?? null;
  const openMemory = ui?.memory ? MEMORIES.find((m) => m.id === ui.memory) : null;
  // counted in the order she has seen them: the first she opens is 1 of 5, the fifth is 5 of 5
  const seenOrder = ui?.seenMemories ?? [];
  const memoryPosition = openMemory ? seenOrder.indexOf(openMemory.id) + 1 : 0;
  const allMemoriesSeen = seenOrder.length === MEMORIES.length;
  const prepareEpilogue = allMemoriesSeen || Boolean(ui?.letterOpen || ui?.epilogueReady);

  const currentMemoryId = ui?.memory ?? null;
  useEffect(() => {
    if (!currentMemoryId) {
      unlockNavigation();
      lastMemoryIdRef.current = null;
      return;
    }
    if (currentMemoryId !== lastMemoryIdRef.current) {
      lastMemoryIdRef.current = currentMemoryId;
      navigationLockedRef.current = true;
      setIsNavigating(true);
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const settleMs = reduced ? 150 : 650;
      unlockTimerRef.current = window.setTimeout(() => {
        unlockNavigation();
      }, settleMs);
    }
  }, [currentMemoryId, unlockNavigation]);

  useEffect(() => {
    return () => clearNavTimers();
  }, [clearNavTimers]);
  const [shownWhisper, setShownWhisper] = useState<string | null>(null);
  useEffect(() => {
    if (whisper) setShownWhisper(whisper);
  }, [whisper]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !prepareEpilogue || epiloguePreparedRef.current) return;
    epiloguePreparedRef.current = true;
    video.preload = 'auto';
    video.load();
  }, [prepareEpilogue]);

  useEffect(() => {
    if (videoRef.current && ui) videoRef.current.muted = ui.muted;
  }, [ui?.muted]);

  // if the film never becomes playable after she asks for it, the ending continues without it
  const stallWatchdogRef = useRef<number | null>(null);
  const clearStallWatchdog = useCallback(() => {
    if (stallWatchdogRef.current !== null) {
      window.clearTimeout(stallWatchdogRef.current);
      stallWatchdogRef.current = null;
    }
  }, []);
  useEffect(() => clearStallWatchdog, [clearStallWatchdog]);

  const finishEpilogue = useCallback((short = false) => {
    clearStallWatchdog();
    if (epilogueRef.current !== 'playing') return;
    const video = videoRef.current;
    video?.pause();
    epilogueRef.current = 'leaving';
    setEpilogue('leaving');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      epilogueRef.current = 'done';
      setEpilogue('done');
      engineRef.current?.completeEpilogue();
    }, reduced ? 220 : short ? 520 : 880);
  }, [clearStallWatchdog]);

  const playEpilogue = useCallback(() => {
    const engine = engineRef.current;
    const video = videoRef.current;
    if (!engine || !video || !ui?.epilogueReady) return;
    engine.beginEpilogue();
    epilogueRef.current = 'playing';
    setEpilogue('playing');
    video.currentTime = 0;
    video.muted = ui.muted;
    if (videoFailed) {
      window.setTimeout(() => finishEpilogue(true), 0);
      return;
    }
    void video.play().catch(() => finishEpilogue(true));
    clearStallWatchdog();
    stallWatchdogRef.current = window.setTimeout(() => {
      stallWatchdogRef.current = null;
      // only a film that never started: not one that is playing, has finished, or was skipped
      if (epilogueRef.current === 'playing' && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && video.currentTime < 0.05 && !video.ended) {
        finishEpilogue(true);
      }
    }, EPILOGUE_STALL_MS);
  }, [clearStallWatchdog, finishEpilogue, ui?.epilogueReady, ui?.muted, videoFailed]);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video || epilogue !== 'playing') return;
      if (document.hidden) video.pause();
      else void video.play().catch(() => finishEpilogue(true));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [epilogue, finishEpilogue]);

  return (
    <main ref={stageRef} className="stage" aria-describedby="how">
      <div ref={probeRef} className="safe-probe" aria-hidden="true" />
      <canvas ref={canvasRef} className="art" role="img" aria-label="A painting of Ganesh ji, made to be discovered by touch." />

      <p id="how" className="sr-only">
        An interactive painting. Draw across it with a finger or pointer; with a keyboard, press Enter to continue each part.
      </p>

      {showThreshold && <Threshold key={thresholdKey} leaving={phase !== 'threshold'} onLight={light} />}

      <p className={`whisper ${whisper ? 'is-on' : ''}`} aria-live="polite">
        {shownWhisper}
      </p>

      <p className={`stroke-prompt ${ui?.strokePrompt ? 'is-on' : ''}`} aria-live="polite">
        One stroke from you.
      </p>

      <div className={`final ${ui?.finalLine && !ui.memory && !ui.letterOpen && !ui.finalBlessing ? 'is-on' : ''}`} aria-live="polite">
        <p className={`final-line ${ui && ui.finalLine >= 1 ? 'is-on' : ''}`}>Every year, you bring him home.</p>
        <p className={`final-memory ${ui && ui.finalLine >= 2 ? 'is-on' : ''}`}>Five memories are waiting in the painting.</p>
      </div>

      <p className={`letter-prompt ${ui?.letterPrompt ? 'is-on' : ''}`} aria-live="polite">And one more thing.</p>

      <p className={`memory-guide ${ui?.memoryGuide && !ui.memory ? 'is-on' : ''}`} aria-live="polite">Touch where the light catches.</p>

      <div className="ending-copy-zone">
        <div className={`final-blessing ${ui?.finalBlessing ? 'is-on' : ''}`} aria-live="polite">
          <p>Ganpati Bappa Morya</p>
          <p className={`final-farewell ${ui?.finalFarewell ? 'is-on' : ''}`}>Pudhchya varshi lavkar ya.</p>
        </div>

        {ui?.epilogueReady && epilogue === 'idle' && (
          <button className="epilogue-offer" type="button" onClick={playEpilogue}>One last blessing</button>
        )}
      </div>

      {phase === 'living' && ui?.letterAvailable && !ui.memory && !ui.letterOpen && ui.letterButton && (
        <button
          className="folded-note"
          type="button"
          style={{ left: ui.letterButton.x, top: ui.letterButton.y }}
          aria-label="Open a note for Nikki"
          onClick={openLetter}
        >
          <FoldedPatra />
        </button>
      )}

      {ui?.letterOpen && (
        <div className={`letter-wash ${folding ? 'is-folding' : ''}`}>
          <button autoFocus className="letter-paper" type="button" aria-label="Fold the note and return to the painting" onClick={foldLetter}>
            <PatraSheet />
            <span className="letter-words">
              <span className="letter-salutation">Nikki,</span>
              <span>Every year, I see the care with which you welcome Him home.</span>
              <span>The flowers, the preparations, every little detail—you make the whole home feel different.</span>
              <span>I wanted to return a little of that feeling to you.</span>
              <span>This part of you is beautiful to watch.</span>
              <span className="letter-signoff">Ganpati Bappa Morya.</span>
            </span>
          </button>
        </div>
      )}

      {ui?.replay && phase === 'living' && !ui.memory && !ui.memoryGuide && !ui.letterAvailable && !ui.letterPrompt && !ui.letterOpen && !ui.finalBlessing && !ui.epilogueReady && epilogue !== 'playing' && epilogue !== 'leaving' && (
        <button className={`replay ${epilogue === 'done' ? 'after-blessing' : ''}`} type="button" onClick={replay}>
          paint it again
        </button>
      )}

      {ui?.audio && <SoundToggle muted={ui.muted} quiet={phase === 'living' || phase === 'reveal'} onToggle={() => engineRef.current?.setMuted(!ui.muted)} />}
      <ImmersiveToggle root={stageRef} hidden={epilogue === 'playing' || epilogue === 'leaving'} quiet={phase === 'living' || phase === 'reveal'} />

      <section className={`epilogue-layer is-${epilogue}`} aria-hidden={epilogue !== 'playing'}>
        <video
          ref={videoRef}
          className="epilogue-video"
          src={`${import.meta.env.BASE_URL}epilogue/morya-blessing.mp4`}
          preload={prepareEpilogue ? 'auto' : 'none'}
          playsInline
          disablePictureInPicture
          onPlaying={clearStallWatchdog}
          onEnded={() => window.setTimeout(() => finishEpilogue(false), 160)}
          onError={() => { setVideoFailed(true); if (epilogue === 'playing') finishEpilogue(true); }}
        />
        {(epilogue === 'playing' || epilogue === 'leaving') && (
          <div className="epilogue-controls">
            <button type="button" onClick={() => finishEpilogue(true)} aria-label="Skip the final blessing film">×</button>
            <button
              type="button"
              onClick={() => engineRef.current?.setMuted(!ui?.muted)}
              aria-label={ui?.muted ? 'Unmute the final blessing film' : 'Mute the final blessing film'}
            >
              {ui?.muted ? 'sound' : 'quiet'}
            </button>
          </div>
        )}
      </section>

      {phase === 'living' && !ui?.memory && !ui?.letterOpen && (
        <div className="memory-keys">
          {ui?.memoryButtons.map((b) => (
            <button
              key={b.id}
              type="button"
              className="memory-key"
              style={{ left: b.x - b.r, top: b.y - b.r, width: b.r * 2, height: b.r * 2 }}
              aria-label={`Open the memory held in ${b.label}`}
              onClick={() => engineRef.current?.openMemoryById(b.id)}
            />
          ))}
        </div>
      )}
      {ui?.memory && ui.memoryRect && openMemory && (
        <div
          className="memory-mode"
          onPointerDown={(e) => {
            // every touch here, even one during a transition, is part of the burst (Back is not a memory action)
            if (e.target instanceof Element && e.target.closest('.memory-back')) return;
            memoryGesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), allowed: noteMemoryAttempt(e.timeStamp), used: false };
          }}
          onPointerUp={(e) => {
            const g = memoryGesture.current;
            if (!g || g.used) return;
            const dx = e.clientX - g.x;
            const dy = e.clientY - g.y;
            if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.25) {
              g.used = true;
              const step = dx < 0 ? 1 : -1;
              if (step > 0 && allMemoriesSeen) {
                finishMemories(g.allowed);
              } else {
                triggerMemoryNav(step, g.allowed);
              }
            }
          }}
        >
          <button className="memory-back" type="button" onClick={backToPainting}>Back to painting</button>

          <div className="memory-status" style={{ top: Math.max(62, ui.memoryRect.y - 52) }} aria-live="polite">
            <span className="memory-year-label">{openMemory.year ?? '\u00a0'}</span>
            <span className="memory-count">{memoryPosition} of {MEMORIES.length}</span>
            <span className="memory-dots" aria-hidden="true">
              {MEMORIES.map((m, i) => (
                <i key={m.id} className={`${i < seenOrder.length ? 'is-seen' : ''} ${i === memoryPosition - 1 ? 'is-current' : ''}`} />
              ))}
            </span>
          </div>

          <div className="memory-actions" style={{ top: ui.memoryRect.y + ui.memoryRect.h + 10 }}>
            <button
              className="memory-next"
              type="button"
              aria-disabled={isNavigating || undefined}
              onClick={allMemoriesSeen ? finishMemoriesByTap : nextMemory}
            >
              {allMemoriesSeen ? 'And one more thing.' : 'Next memory'}
            </button>
            {!allMemoriesSeen && <span className="memory-swipe-hint">or swipe</span>}
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {ui?.memory ? `${MEMORIES.find((m) => m.id === ui.memory)?.alt ?? ''}. Press Escape to return to the painting.` : ''}
      </p>
    </main>
  );
}
