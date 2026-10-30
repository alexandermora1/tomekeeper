import type { PortraitId } from '../api/account';
import { portraitInfo } from './portraits';
import styles from './Portrait.module.css';

interface PortraitProps {
  id: PortraitId;
  /** 'small' is the size used when choosing; 'large' is for the reader's own pages. */
  size?: 'small' | 'large';
  className?: string;
}

/**
 * A reader's portrait in an arched frame. It is decorative: the reader's name is always written next to it,
 * so the image has empty alt text.
 */
export function Portrait({ id, size = 'small', className }: PortraitProps) {
  const portrait = portraitInfo(id);
  return (
    <span className={['paper', styles.frame, styles[size], className].filter(Boolean).join(' ')}>
      <img src={portrait.src} alt="" className={styles.image} style={{ objectPosition: portrait.focus }} />
    </span>
  );
}
