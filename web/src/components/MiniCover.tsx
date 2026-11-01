import { initialFor } from '../woodcuts/initials';
import styles from './MiniCover.module.css';

/** The colour of the band at the top, chosen from the title so a book always gets the same one. */
const BANDS = ['var(--seal-red)', 'var(--blue)', 'var(--seal-green)', 'var(--seal-gold)'] as const;

function bandFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return BANDS[hash % BANDS.length]!;
}

/**
 * A small printed title page: the gold woodcut initial of the book's first letter under a coloured band.
 * Used where there is no cover. Decorative, because the title is always written next to it.
 */
export function MiniCover({ title, seed = title }: { title: string; seed?: string }) {
  const firstLetter = title.replace(/^(the|a|an)\s+/i, '').trim().charAt(0);
  const initial = initialFor(firstLetter);
  return (
    <span aria-hidden="true" className={`paper ${styles.cover}`}>
      <span className={styles.page} style={{ borderTopColor: bandFor(seed) }}>
        {initial ? <img src={initial} alt="" width={46} height={46} className={styles.initial} /> : <span className={styles.letter}>{firstLetter.toUpperCase()}</span>}
      </span>
    </span>
  );
}
