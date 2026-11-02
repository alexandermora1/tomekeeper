import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { chronicle as chronicleApi, type Chronicle } from '../api/chronicle';
import { progress } from '../api/progress';
import type { ShelfEntry } from '../api/shelves';
import { Banner } from '../components/Banner';
import cardStyles from '../components/BookCard.module.css';
import { BookCover } from '../components/BookCover';
import { Button } from '../components/Button';
import { ConfirmEmailNotice } from '../components/ConfirmEmailNotice';
import { DropCap } from '../components/DropCap';
import { formErrorsFrom, problemMessage } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Portrait } from '../components/Portrait';
import { describeGoal, parseWholeNumber } from '../goals/goalText';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import styles from './ChroniclePage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');
const count = (n: number, noun: string) => `${numberFormat.format(n)} ${noun}${n === 1 ? '' : 's'}`;

/**
 * The home page for signed-in readers: the Year's Reckoning against the goal, and the books on Reading now
 * with a quick way to log a page. (The Twelve Labours come in 3.3, quests in stage 4.)
 */
export function ChroniclePage() {
  usePageTitle('Your chronicle');
  const { reader } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<Chronicle | undefined>();
  const [failed, setFailed] = useState<string | undefined>();

  const load = useCallback(
    () =>
      chronicleApi.get(year).then(
        (loaded) => {
          setData(loaded);
          setFailed(undefined);
        },
        (problem: unknown) => setFailed(problemMessage(problem)),
      ),
    [year],
  );
  useEffect(() => {
    void load();
  }, [load]);

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

      <Frame title="The Year’s Reckoning" className={styles.frame}>
        <div className={styles.reader}>
          {reader?.portrait && <Portrait id={reader.portrait} size="large" />}
          <div>
            {failed && <p className={styles.note}>{failed}</p>}
            {data && <Reckoning data={data} />}
          </div>
        </div>
      </Frame>

      {data && <ReadingNow entries={data.readingNow} onLogged={load} />}
    </Layout>
  );
}

function Reckoning({ data }: { data: Chronicle }) {
  const { goal, year } = data;
  const thisYear = year === new Date().getFullYear();
  return (
    <>
      {goal?.pages != null && (
        <Tally heading="Pages" read={data.pagesRead} target={goal.pages} noun="page" bar="pages" pace={thisYear} />
      )}
      {goal?.books != null && (
        <Tally heading="Books" read={data.booksFinished} target={goal.books} noun="book" bar="books" pace={false} />
      )}
      {/* What the goal doesn't count is still worth knowing. */}
      {goal && goal.pages === null && <p className={styles.note}>{count(data.pagesRead, 'page')} read so far.</p>}
      {goal && goal.books === null && <p className={styles.note}>{count(data.booksFinished, 'book')} finished so far.</p>}
      {goal ? (
        <p className={styles.note}>
          Your goal for {year}: <strong>{describeGoal(goal)}</strong> by 31 December. <Link to="/first-steps">Change it</Link>
        </p>
      ) : (
        <>
          <p className={styles.note}>
            So far in {year}: <strong>{count(data.pagesRead, 'page')}</strong> read and{' '}
            <strong>{count(data.booksFinished, 'book')}</strong> finished.
          </p>
          <p className={styles.note}>
            You haven’t set a goal for {year} yet. <Link to="/first-steps">Set your goal</Link>
          </p>
        </>
      )}
    </>
  );
}

interface TallyProps {
  heading: string;
  read: number;
  target: number;
  noun: string;
  /** Pages are red and books blue, as in the 2c design. */
  bar: 'pages' | 'books';
  /** Whether to say how many pages a day reach the goal (only for the year that is going on). */
  pace: boolean;
}

function Tally({ heading, read, target, noun, bar, pace }: TallyProps) {
  const percent = Math.min(100, Math.floor((read / target) * 100));
  return (
    <div className={styles.tally}>
      <h3 className={styles.tallyHeading}>{heading}</h3>
      <p className={styles.tallyLine}>
        <strong className={styles.big}>{numberFormat.format(read)}</strong> of {count(target, noun)}{' '}
        <span className={styles.percent}>({percent}%)</span>
      </p>
      <div className={`${styles.bar} ${bar === 'books' ? styles.blue : ''}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      {read >= target ? (
        <p className={styles.note}>Goal reached. Every {noun} from here is extra.</p>
      ) : (
        pace && <p className={styles.note}>{paceText(target - read)}</p>
      )}
    </div>
  );
}

/** "About 25 pages a day from today reaches your goal." Today counts as one of the days left. */
export function paceText(pagesLeft: number, now = new Date()): string {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = Date.UTC(now.getFullYear(), 11, 31);
  const daysLeft = Math.round((lastDay - today) / 86_400_000) + 1;
  const perDay = Math.ceil(pagesLeft / daysLeft);
  return `About ${count(perDay, 'page')} a day from today reaches your goal.`;
}

function ReadingNow({ entries, onLogged }: { entries: ShelfEntry[]; onLogged: () => Promise<void> }) {
  const [announcement, setAnnouncement] = useState('');
  return (
    <Frame title="Reading now" headingId="reading-now" className={styles.frame}>
      {entries.length === 0 ? (
        <p className={styles.note}>
          Nothing on Reading now. Find a book in the <Link to="/library">Library</Link>, or log a page on a book’s page.
        </p>
      ) : (
        <ul className={cardStyles.list} aria-label="Books you are reading">
          {entries.map((entry) => (
            <QuickLog key={entry.book.id} entry={entry} onLogged={onLogged} onAnnounce={setAnnouncement} />
          ))}
        </ul>
      )}
      <p role="status" className={styles.status}>
        {announcement}
      </p>
    </Frame>
  );
}

interface QuickLogProps {
  entry: ShelfEntry;
  onLogged: () => Promise<void>;
  onAnnounce: (message: string) => void;
}

function QuickLog({ entry, onLogged, onAnnounce }: QuickLogProps) {
  const { book } = entry;
  const total = entry.pageCount ?? book.pageCount;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const fieldId = `log-${book.id}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const page = parseWholeNumber(text);
    if (page === null) {
      setError('Enter the page you’ve reached as a number, such as 120.');
      return;
    }
    setPending(true);
    setError(undefined);
    onAnnounce('');
    try {
      const result = await progress.log(book.id, { page });
      const latest = result.entries[0];
      const finished = latest?.finished ?? false;
      setText('');
      await onLogged();
      onAnnounce(
        finished
          ? `Finished! ${book.title} is on your Finished shelf.`
          : `Logged page ${numberFormat.format(page)} in ${book.title}: ${count(latest?.pages ?? 0, 'page')} read.`,
      );
      // A finished book leaves this list, so the focus goes to the list's heading.
      if (finished) requestAnimationFrame(() => document.getElementById('reading-now')?.focus());
    } catch (problem) {
      const errors = formErrorsFrom(problem, ['page']);
      setError(errors.fields.page ?? errors.general[0]);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={cardStyles.card}>
      <BookCover title={book.title} seed={book.openLibraryKey ?? book.id} coverId={book.coverId} />
      <div className={cardStyles.text}>
        <h3 className={cardStyles.title}>
          <Link to={`/books/${book.id}`}>{book.title}</Link>
        </h3>
        <p className={cardStyles.meta}>
          {entry.page === null
            ? 'Not started yet'
            : `On page ${numberFormat.format(entry.page)}${total ? ` of ${numberFormat.format(total)}` : ''}`}
        </p>
        <form noValidate onSubmit={handleSubmit} className={`${styles.quickLog} ${cardStyles.wide}`}>
          <TextField
            id={fieldId}
            name="page"
            label="Page reached"
            aria-label={`Page reached in ${book.title}`}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={error}
          />
          <Button type="submit" variant="secondary" aria-disabled={pending || undefined}>
            {pending ? 'Saving…' : 'Log'} <span className="visually-hidden">{book.title}</span>
          </Button>
        </form>
      </div>
    </li>
  );
}
