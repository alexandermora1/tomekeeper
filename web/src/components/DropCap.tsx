import { initialFor } from '../woodcuts/initials';
import styles from './DropCap.module.css';

interface DropCapProps {
  /** The paragraph text. Its first letter becomes a woodcut initial. */
  text: string;
  size?: 'large' | 'small';
  className?: string;
}

/**
 * A paragraph that opens with one of Holbein's gold initials.
 * The real first letter stays in the text, visually hidden, so screen readers,
 * search and copy-paste still get the whole word.
 */
export function DropCap({ text, size = 'large', className }: DropCapProps) {
  const first = text.charAt(0);
  const rest = text.slice(1);
  const src = initialFor(first);
  const classes = [styles.paragraph, styles[size], className].filter(Boolean).join(' ');

  if (!src) return <p className={classes}>{text}</p>;

  return (
    <p className={classes}>
      <span aria-hidden="true" className={`paper ${styles.cap}`}>
        <img src={src} alt="" width={208} height={208} className={styles.image} />
      </span>
      <span className="visually-hidden">{first}</span>
      {rest}
    </p>
  );
}
