import { Banner } from '../components/Banner';
import { DropCap } from '../components/DropCap';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import styles from './ChroniclePage.module.css';

/**
 * The home page. For now it only shows the shell of the site; the dashboard
 * (the Year's Reckoning, the Twelve Labours, quests) comes in stage 3 and 4.
 */
export function ChroniclePage() {
  return (
    <Layout current="chronicle" banner={<Banner />}>
      <p className={styles.eyebrow}>Anno {new Date().getFullYear()}</p>
      <h1 className={styles.title}>Tomekeeper</h1>
      <div className={styles.intro}>
        <DropCap text="Keep the year's reckoning. Set a goal in pages, books or both, record your progress as you read, and earn your way through the quests of the year." />
      </div>

      <Frame title="Being built" className={styles.frame}>
        <p className={styles.note}>
          This is the foundation of the site: the look, the light and dark themes and the Plain script setting. Accounts,
          the library and your chronicle come next.
        </p>
      </Frame>
    </Layout>
  );
}
