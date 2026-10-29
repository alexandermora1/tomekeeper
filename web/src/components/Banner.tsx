import small from '../assets/woodcuts/nuremberg-1493-1200.webp';
import large from '../assets/woodcuts/nuremberg-1493-2400.webp';
import styles from './Banner.module.css';

/** View of Nuremberg from the Nuremberg Chronicle (1493). Decorative; credited in the footer. */
export function Banner() {
  return (
    <div className={`paper ${styles.banner}`}>
      <img
        src={small}
        srcSet={`${small} 1200w, ${large} 2400w`}
        sizes="100vw"
        alt=""
        width={2400}
        height={1168}
        decoding="async"
        className={styles.image}
      />
    </div>
  );
}
