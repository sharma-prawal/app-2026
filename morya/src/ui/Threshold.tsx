import { useEffect, useState } from 'react';

interface Props {
  leaving: boolean;
  onLight: () => void;
}

/** Warm paper, a title, and an unlit diya that is the only way in. */
export function Threshold({ leaving, onLight }: Props) {
  const [lit, setLit] = useState(false);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (lit) return;
    const id = window.setTimeout(() => setNudge(true), 7000);
    return () => window.clearTimeout(id);
  }, [lit]);

  const light = () => {
    if (lit) return;
    setLit(true);
    onLight();
  };

  return (
    <section className={`threshold ${lit ? 'is-lit' : ''} ${leaving ? 'is-leaving' : ''}`}>
      <div className="threshold-words">
        <h1 className="threshold-title">Ganpati Bappa Morya</h1>
        <p className="threshold-line">Light the lamp, Nikki.</p>
      </div>
      <button
        type="button"
        className={`diya ${nudge ? 'is-nudging' : ''}`}
        onClick={light}
        aria-label={lit ? 'The diya is lit' : 'Light the diya'}
        aria-pressed={lit}
      >
        <span className="diya-glow" aria-hidden="true" />
        <svg viewBox="0 0 220 170" aria-hidden="true">
          <defs>
            <radialGradient id="flameOuter" cx="0.5" cy="0.85" r="0.9">
              <stop offset="0" stopColor="#fff4d6" />
              <stop offset="0.35" stopColor="#f6c56e" />
              <stop offset="0.75" stopColor="#e2793a" />
              <stop offset="1" stopColor="#d4553a" stopOpacity="0.2" />
            </radialGradient>
            <filter id="paperGrain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0.35 0" result="g" />
              <feComposite in="g" in2="SourceGraphic" operator="in" result="gg" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="gg" />
              </feMerge>
            </filter>
          </defs>
          {/* drawn in the same sepia ink and thin washes as the painting */}
          <g filter="url(#paperGrain)" strokeLinejoin="round" strokeLinecap="round">
            <path d="M86 128 C88 140 134 140 136 128" fill="rgba(196, 154, 78, 0.35)" stroke="#5b3722" strokeWidth="1.3" />
            <path
              d="M38 86 C40 126 90 138 122 134 C152 130 170 116 176 98 C184 93 196 84 202 72 C190 71 176 76 166 83 C140 73 68 72 38 86 Z"
              fill="rgba(196, 116, 72, 0.42)"
              stroke="#5b3722"
              strokeWidth="1.6"
            />
            <path d="M48 87 C80 79 136 79 164 87 C140 97 76 98 48 87 Z" fill="rgba(214, 166, 77, 0.5)" stroke="#5b3722" strokeWidth="0.9" strokeOpacity="0.7" />
            <path d="M50 106 C82 120 140 120 170 104" fill="none" stroke="#5b3722" strokeWidth="0.9" strokeOpacity="0.55" strokeDasharray="1 5" />
            {[66, 88, 110, 132, 152].map((x, i) => (
              <circle key={x} cx={x} cy={112 + Math.sin(((i + 0.5) / 5) * Math.PI) * 3} r="1.8" fill={i % 2 ? '#c8452d' : '#b8904f'} opacity="0.7" />
            ))}
          </g>
          {/* wick */}
          <path d="M184 83 C189 77 193 71 195 63" fill="none" stroke="#5b3722" strokeWidth="2.6" strokeLinecap="round" />
          <circle className="diya-ember" cx="195" cy="62" r="2.2" fill="#d4553a" />
          {/* flame */}
          <g className="diya-flame">
            <path d="M195 61 C181 55 183 33 195 10 C207 33 209 55 195 61 Z" fill="url(#flameOuter)" />
            <path d="M195 58 C189 53 189 41 195 29 C201 41 201 53 195 58 Z" fill="#fff7e2" opacity="0.9" />
          </g>
        </svg>
      </button>
    </section>
  );
}
