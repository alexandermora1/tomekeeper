import { useEffect, useState } from 'react';
import { character as characterApi, type Character } from '../api/character';
import { problemMessage } from '../components/forms/formErrors';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Portrait } from '../components/Portrait';
import { toRoman } from '../game/roman';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import chronicleStyles from './ChroniclePage.module.css';
import styles from './QuestsPage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');

/**
 * The reader's character for the year: level, title and XP. (Quests and gear come in 4.2, attributes and
 * volumes in 4.3.)
 */
export function QuestsPage() {
  usePageTitle('Character and quests');
  const { reader } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const [sheet, setSheet] = useState<Character | undefined>();
  const [failed, setFailed] = useState<string | undefined>();

  useEffect(() => {
    let current = true;
    characterApi.get(year).then(
      (loaded) => current && setSheet(loaded),
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
      {sheet && (
        <div className={styles.columns}>
          {reader?.portrait && (
            <div className={styles.portrait}>
              <Portrait id={reader.portrait} size="large" />
            </div>
          )}
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
