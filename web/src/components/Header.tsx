import { Link, useLocation, useNavigate } from 'react-router';
import { account } from '../api/account';
import { useSession } from '../session/sessionContext';
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
  const { status, setReader } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onAccountPage = pathname === '/sign-in' || pathname === '/sign-up';

  async function signOut() {
    try {
      await account.signOut();
    } catch {
      // The cookie may still be there, so stay signed in. The reader can press the button again.
      return;
    }
    setReader(null);
    navigate('/sign-in', { state: { signedOut: true } });
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          Tomekeeper
        </Link>
        {status === 'signed-in' && (
          <nav aria-label="Main" className={styles.nav}>
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <Link to={item.href} aria-current={item.id === current ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className={styles.toggles}>
          <ToggleButton label="Dark theme" pressed={theme === 'dark'} onClick={onToggleTheme} />
          <ToggleButton label="Plain script" pressed={script === 'plain'} onClick={onToggleScript} />
          {/* The demo has nobody to sign out. */}
          {status === 'signed-in' && import.meta.env.VITE_DEMO !== 'true' && (
            <button type="button" className={styles.action} onClick={() => void signOut()}>
              Sign out
            </button>
          )}
          {status === 'signed-out' && !onAccountPage && (
            <Link to="/sign-in" className={styles.action}>
              Sign in
            </Link>
          )}
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
