import { useId, type ReactNode } from 'react';
import styles from './Frame.module.css';

interface FrameProps {
  title: string;
  /** Heading level inside the frame. Usually 2; 1 when the frame is the whole page; 3 inside a section. */
  level?: 1 | 2 | 3;
  /** Content above the heading, such as the switch between signing in and creating an account. */
  top?: ReactNode;
  /** Extra content beside the heading, such as filter buttons. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A panel with a double ink border, corner ornaments and a heading with a leaf. */
export function Frame({ title, level = 2, top, aside, className, children }: FrameProps) {
  const headingId = useId();
  const Heading = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={headingId} className={[styles.frame, className].filter(Boolean).join(' ')}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <Corner key={corner} position={corner} />
      ))}
      {top}
      <div className={styles.head}>
        <Heading id={headingId} className={styles.title}>
          <Leaf />
          {title}
        </Heading>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false" className={`${styles.corner} ${styles[position]}`}>
      <rect width="22" height="22" style={{ fill: 'var(--ink)' }} />
      <rect x="2.5" y="2.5" width="17" height="17" style={{ fill: 'none', stroke: 'var(--page)', strokeWidth: 1 }} />
      <path
        d="M11 4.5 C13.5 7.5 13.5 9 11 11 C8.5 9 8.5 7.5 11 4.5 Z M11 17.5 C13.5 14.5 13.5 13 11 11 C8.5 13 8.5 14.5 11 17.5 Z M4.5 11 C7.5 8.5 9 8.5 11 11 C9 13.5 7.5 13.5 4.5 11 Z M17.5 11 C14.5 8.5 13 8.5 11 11 C13 13.5 14.5 13.5 17.5 11 Z"
        style={{ fill: 'var(--page)' }}
      />
      <circle cx="11" cy="11" r="1.8" style={{ fill: 'var(--red)' }} />
    </svg>
  );
}

function Leaf() {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true" focusable="false" className={styles.leaf}>
      <path d="M1.5 15 C1.5 9 7 8.5 13 10" style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.4, strokeLinecap: 'round' }} />
      <path
        transform="translate(9 0) rotate(-90 10 10)"
        d="M10 18 C4 13 1 10 1 6.5 C1 3.5 3.5 1.5 6 1.5 C7.8 1.5 9.2 2.5 10 4 C10.8 2.5 12.2 1.5 14 1.5 C16.5 1.5 19 3.5 19 6.5 C19 10 16 13 10 18 Z"
        style={{ fill: 'var(--accent)', stroke: 'var(--ink)', strokeWidth: 1.3, strokeLinejoin: 'round' }}
      />
      <path d="M13 10 H25" style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 1 }} />
    </svg>
  );
}
