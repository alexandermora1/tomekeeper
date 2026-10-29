import type { Script, Theme } from '../theme/preferences';
import styles from './Header.module.css';

export const NAV_ITEMS = [
  { id: 'chronicle', label: 'Chronicle', href: '/' },
  { id: 'library', label: 'Library', href: '/library' },
  { id: 'quests', label: 'Quests', href: '/quests' },
  { id: 'fellowship', label: 'Fellowship', href: '/fellowship' },
  { id: 'profile', label: 'Profile', href: '/profile' },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]['id'];

interface HeaderProps {
  current: NavId | null;
  theme: Theme;
  script: Script;
  onToggleTheme: () => void;
  onToggleScript: () => void;
}

export function Header({ current, theme, script, onToggleTheme, onToggleScript }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          Tomekeeper
        </a>
        <nav aria-label="Main" className={styles.nav}>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <a href={item.href} aria-current={item.id === current ? 'page' : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.toggles}>
          <ToggleButton label="Dark theme" pressed={theme === 'dark'} onClick={onToggleTheme} />
          <ToggleButton label="Plain script" pressed={script === 'plain'} onClick={onToggleScript} />
        </div>
      </div>
    </header>
  );
}

function ToggleButton({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.toggle} aria-pressed={pressed} onClick={onClick}>
      <span aria-hidden="true" className={styles.box}>
        {pressed ? '✓' : ''}
      </span>
      {label}
    </button>
  );
}
