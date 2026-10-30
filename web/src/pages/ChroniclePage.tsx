import { Banner } from '../components/Banner';
import { ConfirmEmailNotice } from '../components/ConfirmEmailNotice';
import { DropCap } from '../components/DropCap';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import styles from './ChroniclePage.module.css';

/**
 * The home page for signed-in readers. For now it only shows the shell of the site; the dashboard
 * (the Year's Reckoning, the Twelve Labours, quests) comes in stages 3 and 4.
 */
export function ChroniclePage() {
  usePageTitle('Your chronicle');
  const { reader } = useSession();

  return (
    <Layout current="chronicle" banner={<Banner />}>
      <p className={styles.eyebrow}>Anno {new Date().getFullYear()}</p>
      <h1 className={styles.title}>Your chronicle</h1>
      <div className={styles.intro}>
        <DropCap text="Keep the year's reckoning. Set a goal in pages, books or both, record your progress as you read, and earn your way through the quests of the year." />
      </div>

      {reader && !reader.emailConfirmed && (
        <div className={styles.notice}>
          <ConfirmEmailNotice email={reader.email} />
        </div>
      )}

      <Frame title="Being built" className={styles.frame}>
        {reader && (
          <p className={styles.note}>
            You're signed in as <strong>{reader.displayName}</strong> ({reader.email}).
          </p>
        )}
        <p className={styles.note}>
          Accounts work now. Your goal and portrait come next, then the library and your chronicle.
        </p>
      </Frame>
    </Layout>
  );
}
