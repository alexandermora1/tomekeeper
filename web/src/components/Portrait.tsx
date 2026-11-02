import type { PortraitId } from '../api/account';
import { portraitInfo } from './portraits';
import styles from './Portrait.module.css';

interface PortraitProps {
  /** null for a reader who hasn't chosen one: an empty arch. */
  id: PortraitId | null;
  /** 'small' is the size used when choosing; 'large' is for the reader's own pages; 'tiny' for lists of readers. */
  size?: 'tiny' | 'small' | 'large';
  className?: string;
}

/**
 * A reader's portrait in an arched frame. It is decorative: the reader's name is always written next to it,
 * so the image has empty alt text.
 */
export function Portrait({ id, size = 'small', className }: PortraitProps) {
  const portrait = id ? portraitInfo(id) : null;
  return (
    <span className={['paper', styles.frame, styles[size], className].filter(Boolean).join(' ')}>
      {portrait && <img src={portrait.src} alt="" className={styles.image} style={{ objectPosition: portrait.focus }} />}
    </span>
  );
}
