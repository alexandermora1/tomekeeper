import { useEffect, useState } from 'react';
import { character as characterApi, type Character } from '../api/character';
import { quests as questsApi, type Quest, type Quests } from '../api/quests';
import { problemMessage } from '../components/forms/formErrors';
import { Frame } from '../components/Frame';
import { GearRing } from '../components/GearRing';
import { Layout } from '../components/Layout';
import { Portrait } from '../components/Portrait';
import { toRoman } from '../game/roman';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import chronicleStyles from './ChroniclePage.module.css';
import styles from './QuestsPage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');

/**
 * The reader's character for the year: the portrait with the gear earned so far, level, title and XP, and the
 * six quests of the year. (Attributes and volumes come in 4.3.)
 */
export function QuestsPage() {
  usePageTitle('Character and quests');
  const { reader } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const [sheet, setSheet] = useState<Character | undefined>();
  const [quests, setQuests] = useState<Quests | undefined>();
  const [failed, setFailed] = useState<string | undefined>();

  useEffect(() => {
    let current = true;
    Promise.all([characterApi.get(year), questsApi.get(year)]).then(
      ([loadedSheet, loadedQuests]) => {
        if (!current) return;
        setSheet(loadedSheet);
        setQuests(loadedQuests);
      },
      (problem: unknown) => current && setFailed(problemMessage(problem)),
    );
    return () => {
      current = false;
    };
  }, [year]);

  return (
    <Layout current="quests">
      <p className={chronicleStyles.eyebrow}>
        Volume {toRoman(year)}
        {sheet && ` · Level ${sheet.level}`}
      </p>
      <h1 className={chronicleStyles.title}>{sheet && reader ? `${reader.displayName} the ${sheet.title}` : 'Character and quests'}</h1>
      {failed && <p>{failed}</p>}
      {sheet && quests && (
        <div className={styles.columns}>
          <Frame title="Portrait and gear" className={styles.gearFrame}>
            <p className={styles.rule}>
              <span aria-hidden="true">☞ </span>Gear is only for show. Choose a slot to see where its piece comes from.
            </p>
            <GearRing gear={quests.gear}>{reader?.portrait && <Portrait id={reader.portrait} size="large" />}</GearRing>
          </Frame>
          <Frame title="Level" className={styles.frame}>
            <LevelBar sheet={sheet} />
            <h3 id="titles" className={styles.subheading}>
              Titles
            </h3>
            <ol className={styles.titles} aria-labelledby="titles">
              {sheet.titles.map((title) => {
                const current = title.name === sheet.title;
                return (
                  <li key={title.name} className={current ? styles.currentTitle : undefined} aria-current={current ? 'true' : undefined}>
                    <strong>{title.name}</strong> · {title.to === null ? `level ${title.from} and up` : `levels ${title.from} to ${title.to}`}
                  </li>
                );
              })}
            </ol>
          </Frame>
          <Frame title={`Quests of ${toRoman(year)}`} className={styles.questsFrame}>
            <QuestList quests={quests.quests} />
          </Frame>
        </div>
      )}
    </Layout>
  );
}

function LevelBar({ sheet }: { sheet: Character }) {
  const span = sheet.nextLevelAt - sheet.levelStartsAt;
  const percent = Math.floor(((sheet.xp - sheet.levelStartsAt) / span) * 100);
  return (
    <>
      <p className={styles.xp}>
        <strong className={chronicleStyles.big}>{numberFormat.format(sheet.xp)} XP</strong> this year
      </p>
      <div className={chronicleStyles.bar} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className={chronicleStyles.note}>
        {numberFormat.format(sheet.nextLevelAt - sheet.xp)} XP to level {sheet.level + 1}. So far:{' '}
        {numberFormat.format(sheet.pagesXp)} for pages and {numberFormat.format(sheet.finishXp)} for finishing books.
      </p>
      <p className={styles.rule}>
        1 XP per page, plus a quarter of a book’s pages when you finish it. Levels start again each January.
      </p>
    </>
  );
}

const FILTERS = [
  ['all', 'All'],
  ['active', 'Under way'],
  ['done', 'Complete'],
  ['soon', 'Coming'],
] as const;
type Filter = (typeof FILTERS)[number][0];
const STATES: Record<Quest['state'], string> = { done: 'Complete', active: 'Under way', soon: 'Not yet open' };

function QuestList({ quests }: { quests: Quest[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = quests.filter((quest) => filter === 'all' || quest.state === filter);
  return (
    <>
      <div className={styles.filters} role="group" aria-label="Show quests">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.rule}>No quests here yet.</p>
      ) : (
        <ul className={styles.quests} aria-label="Quests">
          {shown.map((quest) => (
            <li key={quest.id} className={`${styles.quest} ${styles[quest.state]}`}>
              <div className={styles.questHead}>
                <h3 className={styles.questName}>{quest.name}</h3>
                <span className={styles.questState}>{STATES[quest.state]}</span>
              </div>
              <p>{quest.task}</p>
              {quest.state === 'active' && (
                <div className={chronicleStyles.bar} aria-hidden="true">
                  <span style={{ width: `${quest.percent}%` }} />
                </div>
              )}
              <p className={styles.progress}>{quest.progress}</p>
              <p className={styles.reward}>
                Reward: {quest.reward} ({quest.slot})
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.rule}>
        <span aria-hidden="true">☞ </span>New quests open each 1 January. Gear you earn is kept for good.
      </p>
    </>
  );
}
