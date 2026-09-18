// The note: a narrow handmade patra, drawn in the painting's own sepia, gold and sindoor.
// Folded, it rests by the offerings tied with a mauli thread; opened, it is the same sheet unfolded.

const PAPER = '#f2e4c7';
const PAPER_DEEP = '#e6d2ae';
const GOLD = '#a8834a';
const SINDOOR = '#c8452d';

/** Handmade paper: deckled edge, fibre and tooth. Shared by both states. */
function PaperDefs({ id, scale }: { id: string; scale: number }) {
  return (
    <defs>
      <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#f6ead0" />
        <stop offset="0.55" stopColor={PAPER} />
        <stop offset="1" stopColor={PAPER_DEEP} />
      </linearGradient>
      {/* the edge is torn along a deckle, never cut */}
      <filter id={`${id}-deckle`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency={0.09 / scale} numOctaves="4" seed="7" result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale={11 * scale} xChannelSelector="R" yChannelSelector="G" result="torn" />
        <feTurbulence type="fractalNoise" baseFrequency={0.8 / scale} numOctaves="2" seed="3" result="fibre" />
        <feColorMatrix in="fibre" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.24  0 0 0 0 0.14  0 0 0 0.2 0" result="tooth" />
        <feComposite in="tooth" in2="torn" operator="in" result="grain" />
        <feMerge>
          <feMergeNode in="torn" />
          <feMergeNode in="grain" />
        </feMerge>
      </filter>
      <filter id={`${id}-waver`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency={0.05 / scale} numOctaves="2" seed="11" result="w" />
        <feDisplacementMap in="SourceGraphic" in2="w" scale={2.4 * scale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  );
}

/** Folded in three and tied: the small object placed near the offerings. */
export function FoldedPatra() {
  return (
    <svg viewBox="0 0 34 46" aria-hidden="true">
      <PaperDefs id="pf" scale={0.4} />
      <g filter="url(#pf-deckle)">
        <rect x="4" y="3" width="26" height="40" rx="1" fill="url(#pf-wash)" />
        {/* pigment gathered at the torn edge */}
        <rect x="4" y="3" width="26" height="40" rx="1" fill="none" stroke="rgba(120, 82, 44, 0.32)" strokeWidth="0.8" />
      </g>
      <rect x="6.5" y="5.5" width="21" height="35" fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="0.45" filter="url(#pf-waver)" />
      {/* the folds */}
      <path d="M5 16.5 H29" stroke="rgba(110, 74, 42, 0.28)" strokeWidth="0.5" />
      <path d="M5 17.2 H29" stroke="rgba(255, 250, 235, 0.7)" strokeWidth="0.4" />
      <path d="M5 29.8 H29" stroke="rgba(110, 74, 42, 0.22)" strokeWidth="0.5" />
      {/* sindoor */}
      <path d="M15.6 9.6 C15.5 8.4 16.6 7.8 17.6 8.1 C18.7 8.5 18.8 9.8 18.3 10.7 C17.8 11.6 16.5 11.8 15.9 11.1 C15.6 10.7 15.6 10.2 15.6 9.6 Z" fill={SINDOOR} opacity="0.85" />
      {/* mauli: red and saffron threads, twisted, knotted, ends loose */}
      <g fill="none" strokeLinecap="round">
        <path d="M2.5 24.2 C9 22.8 14 25.6 19 23.8 C24 22.2 28 24.8 32 23.4" stroke="#b3322a" strokeWidth="1" />
        <path d="M2.5 24.9 C9 26 14 23.2 19 24.8 C24 26.4 28 23.6 32 24.6" stroke="#d99a3a" strokeWidth="0.7" />
        <path d="M19 24.2 C20.5 27.5 20 30.5 18.6 33.5" stroke="#b3322a" strokeWidth="0.8" />
        <path d="M19.3 24.6 C21.8 27 22.8 29.6 22.6 32.4" stroke="#d99a3a" strokeWidth="0.6" />
      </g>
      <circle cx="19.1" cy="24.2" r="1.25" fill="#a52b24" />
    </svg>
  );
}

/** The opened sheet, drawn behind the words. */
export function PatraSheet() {
  return (
    <svg className="patra-sheet" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true">
      <PaperDefs id="ps" scale={1} />
      <g filter="url(#ps-deckle)">
        <rect x="8" y="8" width="284" height="404" fill="url(#ps-wash)" />
        <rect x="8" y="8" width="284" height="404" fill="none" stroke="rgba(120, 82, 44, 0.26)" strokeWidth="2.2" />
      </g>
      {/* a restrained antique-gold rule, drawn by hand */}
      <g filter="url(#ps-waver)" fill="none" stroke={GOLD} strokeLinecap="round">
        <rect x="22" y="22" width="256" height="376" strokeOpacity="0.5" strokeWidth="0.9" />
        <rect x="26" y="26" width="248" height="368" strokeOpacity="0.28" strokeWidth="0.5" />
      </g>
      {/* where it was folded in three: felt more than seen, a soft shade either side of each crease */}
      <defs>
        <linearGradient id="ps-crease" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(108, 72, 40)" stopOpacity="0" />
          <stop offset="0.5" stopColor="rgb(108, 72, 40)" stopOpacity="0.07" />
          <stop offset="0.52" stopColor="rgb(255, 251, 238)" stopOpacity="0.22" />
          <stop offset="1" stopColor="rgb(255, 251, 238)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="10" y="132" width="280" height="16" fill="url(#ps-crease)" />
      <rect x="10" y="272" width="280" height="16" fill="url(#ps-crease)" />
      {/* a thumb of sindoor at the head of the note, as on anything offered */}
      <g transform="translate(150 44)" opacity="0.8">
        <path d="M-4.2 -1 C-4.4 -4.2 -1.2 -5.6 1.6 -4.8 C4.6 -3.9 5 -0.4 3.8 2.2 C2.6 4.8 -1 5.4 -3 3.6 C-4 2.7 -4.1 0.8 -4.2 -1 Z" fill={SINDOOR} />
        {/* the powder is thinner where the thumb lifted */}
        <path d="M-1.6 -2.2 C0.2 -3.2 2.2 -2.4 2.4 -0.6 C2.6 1.2 0.6 2.2 -1 1.4 C-2.4 0.7 -2.8 -1.4 -1.6 -2.2 Z" fill="#e0785a" opacity="0.45" />
      </g>
      {/* one marigold petal, pressed flat by the lower edge: a ruffled fan, its colour gone a little into the paper */}
      <g transform="translate(244 372) rotate(-28)" opacity="0.72">
        <path
          d="M0 0 C-3.4 -2.2 -7.6 -7.4 -8.4 -12.6 C-7 -13.6 -6.2 -12.4 -5 -13.8 C-3.8 -15.2 -2.6 -13.8 -1.2 -15 C0.2 -16.2 1.4 -14.6 2.8 -15.4 C4.2 -16.2 5 -14.4 6.4 -14.4 C7.6 -9.2 4.2 -3 0 0 Z"
          fill="#e39a34"
        />
        <path d="M0 -0.8 C-0.8 -5 -1.2 -9.4 -1.4 -13.6 M0 -0.8 C1.2 -5 2.6 -9.2 4 -13.4 M0 -0.8 C-2 -4.6 -4 -8.6 -5.6 -12.4" stroke="#bf6c1e" strokeWidth="0.45" fill="none" opacity="0.6" />
      </g>
    </svg>
  );
}
