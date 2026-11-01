import { useState } from 'react';
import { coverUrl } from '../api/books';
import styles from './BookCover.module.css';
import { MiniCover } from './MiniCover';

interface BookCoverProps {
  title: string;
  /** What picks the colour of the woodcut title page, so a book always gets the same one. */
  seed?: string;
  coverId: number | null;
  /** The book page's size, 180 by 270 pixels. Otherwise 64 by 96. */
  large?: boolean;
}

/**
 * A book's cover from Open Library, through Tomekeeper's own API so the reader's browser never contacts
 * Open Library. When there is no cover, or it doesn't load, the woodcut title page stands in.
 * Decorative (empty alt text), because the title is always written next to it.
 */
export function BookCover({ title, seed, coverId, large = false }: BookCoverProps) {
  const [failed, setFailed] = useState<number | null>(null);
  if (coverId === null || failed === coverId) return <MiniCover title={title} seed={seed} large={large} />;
  return (
    <span className={large ? `${styles.cover} ${styles.large}` : styles.cover}>
      <img
        src={coverUrl(coverId, large ? 'l' : 'm')}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(coverId)}
        className={styles.image}
      />
    </span>
  );
}
