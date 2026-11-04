import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import styles from './StatementPage.module.css';

/** Where the pictures and typefaces come from. Address: /credits, open to everyone. The same list is in docs/image-credits.md. */
export function CreditsPage() {
  usePageTitle('Image credits');
  return (
    <Layout current={null}>
      <article className={styles.page}>
        <h1 className={styles.title}>Image credits</h1>
        <p>
          Every picture on Tomekeeper is in the public domain or under CC0. The woodcuts were cleaned up into ink on a
          clear background so they sit on the page colour; some were recoloured, as noted.
        </p>

        <h2>View of Nuremberg</h2>
        <p>
          The banner. From the Nuremberg Chronicle by Hartmann Schedel, printed by Anton Koberger in 1493 (folios 99v–100r,
          two pages joined). Boston Public Library copy, on the{' '}
          <a href="https://archive.org/details/chroniconnurembe00sche">Internet Archive</a>. Public Domain Mark 1.0. The two
          pages were joined and the paper removed.
        </p>

        <h2>The portraits</h2>
        <p>
          The Astrologer, the Knight and the Emperor: details from the Dance of Death, designed by Hans Holbein the Younger
          and cut by Hans Lützelburger, 1523–25. Rijksmuseum, via the{' '}
          <a href="https://pdimagearchive.org">Public Domain Image Archive</a>. CC0. Cropped with Death left out, and the
          paper removed.
        </p>

        <h2>The initials</h2>
        <p>
          The Alphabet of Death, 24 letters cut by Hans Lützelburger after Hans Holbein the Younger, about 1523. National
          Gallery of Art, Washington, Rosenwald Collection (for example{' '}
          <a href="https://www.nga.gov/artworks/11940-letter-p">the letter P</a>). Public domain. Washed in gold, with the
          paper removed. The alphabet has no J or U: as in books of the time, I stands in for J and V for U.
        </p>

        <h2>The sun</h2>
        <p>
          The sun with a face in the middle of the Twelve Labours: a detail of a broadsheet woodcut of a celestial
          phenomenon over Nuremberg, 1556. Zentralbibliothek Zürich, via the{' '}
          <a href="https://pdimagearchive.org/images/296bb0f4-4258-40db-b22f-6e51ecbf48c5">Public Domain Image Archive</a>.
          Public Domain Mark 1.0. Cut out of its sky and recoloured gold.
        </p>

        <h2>Typefaces</h2>
        <p>
          Grenze Gotisch (headings), Alegreya and Alegreya SC (text), all under the SIL Open Font License, served from
          Tomekeeper itself. The “Sign in with Google” button uses Google Sans and Google’s logo, as Google’s branding rules
          ask.
        </p>
        <p>Book covers come from Open Library.</p>
      </article>
    </Layout>
  );
}
