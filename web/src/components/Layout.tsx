import type { ReactNode } from 'react';
import { usePreferences } from '../theme/usePreferences';
import { Footer } from './Footer';
import { Header, type NavId } from './Header';
import { VineStrip } from './VineStrip';
import styles from './Layout.module.css';

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
