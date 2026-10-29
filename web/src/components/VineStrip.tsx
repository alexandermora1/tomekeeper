import { useId } from 'react';

/** The woodcut vine border under the header or banner. Decorative only. */
export function VineStrip() {
  const id = useId().replace(/:/g, '');
  const pattern = `vine-${id}`;
  return (
    <div aria-hidden="true" style={{ background: 'var(--chrome)' }}>
      <svg width="100%" height="24" focusable="false">
        <defs>
          <pattern id={pattern} width="48" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 2.5 H48 M0 21.5 H48" style={{ fill: 'none', stroke: 'var(--chrome-ink)', strokeWidth: 1 }} />
            <path d="M0 12 C12 3 12 3 24 12 S36 21 48 12" style={{ fill: 'none', stroke: 'var(--chrome-ink)', strokeWidth: 1.5 }} />
            <path d="M12 7.5 C14 4 18.5 3.8 20.5 5.6 C18 7.6 15 8 12 7.5 Z" style={{ fill: 'var(--chrome-ink)' }} />
            <path d="M36 16.5 C34 20 29.5 20.2 27.5 18.4 C30 16.4 33 16 36 16.5 Z" style={{ fill: 'var(--chrome-ink)' }} />
            <circle cx="5" cy="15.5" r="1.7" style={{ fill: 'var(--gold)' }} />
            <circle cx="43" cy="8.5" r="1.7" style={{ fill: 'var(--gold)' }} />
          </pattern>
        </defs>
        <rect width="100%" height="24" style={{ fill: `url(#${pattern})` }} />
      </svg>
    </div>
  );
}
