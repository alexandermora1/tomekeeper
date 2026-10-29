import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <ul className={styles.links}>
          <li>
            <a href="/privacy">Privacy</a>
          </li>
          <li>
            <a href="/accessibility">Accessibility statement</a>
          </li>
          <li>
            <a href="/settings">Settings</a>
          </li>
          <li>
            <a href="/credits">Image credits</a>
          </li>
        </ul>
        <p className={styles.credits}>
          Banner: view of Nuremberg from Hartmann Schedel's{' '}
          <a href="https://archive.org/details/chroniconnurembe00sche">Nuremberg Chronicle</a> (1493), Boston Public
          Library copy via the Internet Archive. Public domain. Portraits: details from Hans Holbein's Dance of Death
          (1523–25), cut by Hans Lützelburger, Rijksmuseum, CC0. Initials: Lützelburger after Holbein, Alphabet of Death
          (about 1523), National Gallery of Art, Washington. Public domain, gold colouring added. Sun: detail from a
          broadsheet of a celestial phenomenon over Nuremberg, 1556, Zentralbibliothek Zürich. Public domain,
          recoloured.
        </p>
      </div>
    </footer>
  );
}
