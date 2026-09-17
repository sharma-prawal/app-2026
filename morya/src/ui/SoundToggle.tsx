interface Props {
  muted: boolean;
  quiet?: boolean;
  onToggle: () => void;
}

export function SoundToggle({ muted, quiet, onToggle }: Props) {
  return (
    <button type="button" className={`sound ${quiet ? 'is-quiet' : ''}`} onClick={onToggle} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {muted ? (
          <path d="M4 12 C8 12 16 12 20 12" />
        ) : (
          <>
            <path d="M6 9.5 V14.5" />
            <path d="M10 6.5 V17.5" />
            <path d="M14 8.5 V15.5" />
            <path d="M18 10.5 V13.5" />
          </>
        )}
      </svg>
    </button>
  );
}
