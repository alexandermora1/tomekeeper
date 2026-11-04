import { useSite } from '../api/site';
import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import styles from './StatementPage.module.css';

const UPDATED = '4 November 2026';

/** The accessibility statement. Address: /accessibility, open to everyone. */
export function AccessibilityPage() {
  usePageTitle('Accessibility statement');
  const site = useSite();

  return (
    <Layout current={null}>
      <article className={styles.page}>
        <h1 className={styles.title}>Accessibility statement</h1>
        <p className={styles.updated}>Last changed {UPDATED}.</p>

        <p>
          Tomekeeper should work for everyone who reads, whatever way they use the web. The aim is to meet the Web Content
          Accessibility Guidelines (WCAG) 2.2 at level AA, which includes what Norwegian law asks for (WCAG 2.1 AA).
        </p>

        <h2>What you can do on Tomekeeper</h2>
        <ul>
          <li>Use every part of the site with the keyboard alone. A “Skip to content” link is the first thing on each page.</li>
          <li>Switch the decorative blackletter headings to <strong>Plain script</strong>, with the button at the top of every page.</li>
          <li>
            Use the dark theme. Tomekeeper follows your device’s light or dark setting until you choose, and remembers your
            choice.
          </li>
          <li>Zoom to 400 percent, or use a screen as narrow as 320 pixels, without scrolling sideways.</li>
          <li>Hear changes with a screen reader: saved progress, moved books and form errors are announced.</li>
          <li>Fix form errors from a list at the top of the form, where each error links to its field.</li>
          <li>Use the site with reduced motion: Tomekeeper follows that setting on your device.</li>
          <li>
            Read the Twelve Labours, the wheel of the year, as a list of months with their pages. A screen reader always
            gets the list.
          </li>
        </ul>

        <h2>How it is checked</h2>
        <p>
          Each step of building Tomekeeper is tested in a real browser with axe, an automatic accessibility checker, in the
          light and dark themes and at phone width, and the main tasks are walked through with the keyboard. The tests also
          check that buttons and fields have names a screen reader can say, and where the keyboard focus goes after each
          action.
        </p>
        <p>
          Automatic checks find only some problems. A full manual review against WCAG 2.2, including a walk through the site
          with the VoiceOver screen reader, comes next. This statement will be updated with what it finds.
        </p>

        <h2>Known problems</h2>
        <ul>
          <li>
            The headings use a blackletter typeface that some readers find hard to read. Plain script replaces it with an
            ordinary typeface.
          </li>
          <li>
            The site sleeps when nobody has used it for a while (it runs on a free hosting plan), so the first page after a
            pause can take some seconds to load.
          </li>
          <li>Book covers come from Open Library and have no text of their own; the book’s title is always next to the cover.</li>
        </ul>

        <h2>Tell us about a problem</h2>
        <p>
          If something on Tomekeeper doesn’t work for you, please write to{' '}
          {site?.contactEmail ? (
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
          ) : (
            'the contact address shown here when the site is online'
          )}
          . Say which page, what you tried, and what you use (for example a screen reader or zoom).
        </p>
      </article>
    </Layout>
  );
}
