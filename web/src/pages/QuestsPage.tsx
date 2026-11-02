import { useEffect, useState } from 'react';
import { character as characterApi, type Character } from '../api/character';
import { legacy as legacyApi, type Legacy } from '../api/legacy';
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
 * attributes, the six quests of the year, and the volumes of the years so far.
 */
export function QuestsPage() {
  usePageTitle('Character and quests');
  const { reader } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const [sheet, setSheet] = useState<Character | undefined>();
  const [quests, setQuests] = useState<Quests | undefined>();
  const [legacy, setLegacy] = useState<Legacy | undefined>();
  const [failed, setFailed] = useState<string | undefined>();

  useEffect(() => {
    let current = true;
    Promise.all([characterApi.get(year), questsApi.get(year), legacyApi.get()]).then(
      ([loadedSheet, loadedQuests, loadedLegacy]) => {
        if (!current) return;
        setSheet(loadedSheet);
        setQuests(loadedQuests);
        setLegacy(loadedLegacy);
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
      {sheet && quests && legacy && (
        <div className={styles.columns}>
          <Frame title="Portrait and gear" className={styles.gearFrame}>
            <p className={styles.rule}>
              <span aria-hidden="true">☞ </span>Gear is only for show. Choose a slot to see where its piece comes from.
            </p>
            <GearRing gear={quests.gear}>{reader?.portrait && <Portrait id={reader.portrait} size="large" />}</GearRing>
          </Frame>
          <Frame title="Level and attributes" className={styles.frame}>
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
            <Attributes legacy={legacy} />
          </Frame>
          <Frame title={`Quests of ${toRoman(year)}`} className={styles.questsFrame}>
            <QuestList quests={quests.quests} />
          </Frame>
          <Frame title="Volumes" className={styles.questsFrame}>
            <Volumes legacy={legacy} thisYear={year} />
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

function Attributes({ legacy }: { legacy: Legacy }) {
  return (
    <>
      <h3 id="attributes" className={styles.subheading}>
        Attributes
      </h3>
      <p className={styles.rule}>One point per 500 pages of each kind. They grow for as long as you read.</p>
      <ul className={styles.attributes} aria-labelledby="attributes">
        {legacy.attributes.map((attribute) => (
          <li key={attribute.name}>
            <div className={styles.attributeHead}>
              <strong>{attribute.name}</strong>
              <span className={styles.attributeValue}>{attribute.value}</span>
            </div>
            <div className={`${chronicleStyles.bar} ${chronicleStyles.blue}`} aria-hidden="true">
              <span style={{ width: `${((500 - attribute.toNext) / 500) * 100}%` }} />
            </div>
            <p className={styles.attributeFrom}>
              {attribute.from} · next point in {numberFormat.format(attribute.toNext)} pages
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Volumes({ legacy, thisYear }: { legacy: Legacy; thisYear: number }) {
  return (
    <>
      <p className={styles.rule}>Each year is bound as a volume when it ends.</p>
      {/* Focusable, so keyboard users can scroll the table sideways on a narrow screen. */}
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Volumes table">
        <table className={styles.volumes}>
          <thead>
            <tr>
              <th scope="col">Volume</th>
              <th scope="col">Pages</th>
              <th scope="col">Books</th>
              <th scope="col">Level reached</th>
              <th scope="col">Quests</th>
            </tr>
          </thead>
          <tbody>
            {legacy.volumes.map((volume) => {
              const soFar = volume.year === thisYear ? ' so far' : '';
              return (
                <tr key={volume.year}>
                  <th scope="row">
                    {toRoman(volume.year)} <span className="visually-hidden">({volume.year})</span>
                  </th>
                  <td>
                    {numberFormat.format(volume.pages)}
                    {soFar}
                  </td>
                  <td>
                    {numberFormat.format(volume.books)}
                    {soFar}
                  </td>
                  <td>
                    {volume.level}
                    {soFar}
                  </td>
                  <td>{volume.quests} of 6</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
