import { DEMO_TODAY } from './demoApi';
import styles from './DemoBanner.module.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Above every page of the demo: what this is, and that nothing is saved. */
export function DemoBanner() {
  return (
    // A named region, so screen reader users moving by landmark find it too.
    <section className={styles.banner} aria-label="About this demo">
      <p>
        <strong>A demo with example data.</strong> You are looking around as Alex, an example reader, on{' '}
        {dateFormat.format(new Date(`${DEMO_TODAY}T12:00:00`))}. Everything can be looked at, but nothing you change is
        saved. <a href="https://github.com/alexandermora1/tomekeeper">How Tomekeeper is made, on GitHub</a>
      </p>
    </section>
  );
}
