import { lazy, Suspense, type ReactNode } from 'react';
import { usePreferences } from '../theme/usePreferences';
import { Footer } from './Footer';
import { Header, type NavId } from './Header';
import { VineStrip } from './VineStrip';
import styles from './Layout.module.css';

// Only the demo build has the banner (src/demo). In other builds this is null, and the demo code and its
// recorded data are left out of the bundle.
const DemoBanner =
  import.meta.env.VITE_DEMO === 'true' ? lazy(() => import('../demo/DemoBanner').then((module) => ({ default: module.DemoBanner }))) : null;

interface LayoutProps {
  current: NavId | null;
  /** Full-width art between the header and the vine strip, such as the Nuremberg banner. */
  banner?: ReactNode;
  children: ReactNode;
}

export function Layout({ current, banner, children }: LayoutProps) {
  const { theme, script, toggleTheme, toggleScript } = usePreferences();
  return (
    <div className={styles.page}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {DemoBanner && (
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
      )}
      <Header current={current} theme={theme} script={script} onToggleTheme={toggleTheme} onToggleScript={toggleScript} />
      {banner}
      <VineStrip />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
