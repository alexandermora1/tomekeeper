import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import nurembergSmall from '../assets/woodcuts/nuremberg-1493-1200.webp';
import nurembergLarge from '../assets/woodcuts/nuremberg-1493-2400.webp';
import { Frame } from './Frame';
import { Layout } from './Layout';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  /** The heading of the framed panel. */
  title: string;
  /** A short line under the heading. */
  lead?: ReactNode;
  /**
   * Sign in and sign up show what Tomekeeper is beside the form, under the page's h1.
   * The other account pages (forgot password, confirm email) are just the panel, with the title as h1.
   */
  intro?: boolean;
  /** Content above the heading, such as <AuthSwitch>. */
  top?: ReactNode;
  children: ReactNode;
}

/** The layout for the account pages: a framed panel, with or without the introduction beside it. */
export function AuthLayout({ title, lead, intro = false, top, children }: AuthLayoutProps) {
  const panel = (
    <Frame title={title} level={intro ? 2 : 1} top={top} className={styles.panel}>
      {lead && <p className={styles.lead}>{lead}</p>}
      {children}
    </Frame>
  );

  return (
    <Layout current={null}>
      {intro ? (
        <div className={styles.columns}>
          <Introduction />
          {panel}
        </div>
      ) : (
        <div className={styles.single}>{panel}</div>
      )}
    </Layout>
  );
}

function Introduction() {
  return (
    <div className={styles.intro}>
      <div className={`paper ${styles.plate}`}>
        <img
          src={nurembergSmall}
          srcSet={`${nurembergSmall} 1200w, ${nurembergLarge} 2400w`}
          sizes="(min-width: 1240px) 580px, (min-width: 900px) 46vw, 100vw"
          alt=""
          width={1200}
          height={584}
          className={styles.image}
        />
      </div>
      <h1 className={styles.heading}>Keep the year's reckoning</h1>
      <ul className={styles.points}>
        <li>Set a goal in pages, books or both, and log as you read.</li>
        <li>Every page gives XP. Quests through the year earn gear for your reader.</li>
        <li>Share with friends, or keep it all to yourself.</li>
      </ul>
    </div>
  );
}

/** The two tabs at the top of the sign-in and sign-up panels. They are links, because each is its own page. */
export function AuthSwitch({ current }: { current: 'sign-in' | 'sign-up' }) {
  // Keep the state, so a reader sent here from another page still goes back there after signing up.
  const { state } = useLocation();
  return (
    <div className={styles.switch}>
      <Link to="/sign-in" state={state} aria-current={current === 'sign-in' ? 'page' : undefined}>
        Sign in
      </Link>
      <Link to="/sign-up" state={state} aria-current={current === 'sign-up' ? 'page' : undefined}>
        Create an account
      </Link>
    </div>
  );
}
