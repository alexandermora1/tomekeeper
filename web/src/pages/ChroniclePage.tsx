import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { goals, type Goal } from '../api/goals';
import { Banner } from '../components/Banner';
import { ConfirmEmailNotice } from '../components/ConfirmEmailNotice';
import { DropCap } from '../components/DropCap';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Portrait } from '../components/Portrait';
import { describeGoal } from '../goals/goalText';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import styles from './ChroniclePage.module.css';

/**
 * The home page for signed-in readers. For now it shows the reader and their goal; the dashboard
 * (the Year's Reckoning, the Twelve Labours, quests) comes in stages 3 and 4.
 */
export function ChroniclePage() {
  usePageTitle('Your chronicle');
  const { reader } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const goal = useGoal(year);

  return (
    <Layout current="chronicle" banner={<Banner />}>
      <p className={styles.eyebrow}>Anno {year}</p>
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
        <div className={styles.reader}>
          {reader?.portrait && <Portrait id={reader.portrait} size="large" />}
          <div>
            {reader && (
              <p className={styles.note}>
                You're signed in as <strong>{reader.displayName}</strong> ({reader.email}).
              </p>
            )}
            <GoalLine year={year} goal={goal} />
            <p className={styles.note}>
              Accounts, goals and the Library with your shelves work now. Adding books by hand comes next, then logging your reading.
            </p>
          </div>
        </div>
      </Frame>
    </Layout>
  );
}

function GoalLine({ year, goal }: { year: number; goal: Goal | null | undefined }) {
  if (goal === undefined) return null;
  if (goal === null) {
    return (
      <p className={styles.note}>
        You haven't set a goal for {year} yet. <Link to="/first-steps">Set your goal</Link>
      </p>
    );
  }
  return (
    <p className={styles.note}>
      Your goal for {year}: <strong>{describeGoal(goal)}</strong> by 31 December.{' '}
      <Link to="/first-steps">Change it</Link>
    </p>
  );
}

/** The reader's goal for a year: null when there is none, undefined while loading or if it couldn't be loaded. */
function useGoal(year: number): Goal | null | undefined {
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    goals
      .get(year)
      .catch(() => undefined)
      .then((result) => {
        // Ignore the answer if the page has gone or the year changed while waiting.
        if (current) setGoal(result);
      });
    return () => {
      current = false;
    };
  }, [year]);
  return goal;
}
