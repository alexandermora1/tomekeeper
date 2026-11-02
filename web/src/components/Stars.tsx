import styles from './Stars.module.css';

/** A rating shown as five stars, filled and hollow, so the shape says it as well as the colour. */
export function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} of 5 stars`} className={styles.stars}>
      {'★'.repeat(rating)}
      <span className={styles.hollow}>{'☆'.repeat(5 - rating)}</span>
    </span>
  );
}
