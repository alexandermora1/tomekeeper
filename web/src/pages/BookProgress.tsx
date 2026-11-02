import { useEffect, useState, type FormEvent } from 'react';
import type { Book } from '../api/books';
import { progress as progressApi, type Progress } from '../api/progress';
import type { ShelfEntry } from '../api/shelves';
import { Button } from '../components/Button';
import { Fieldset } from '../components/forms/Fieldset';
import { formErrorsFrom, problemMessage } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Frame } from '../components/Frame';
import { formatDay } from '../dates';
import { parseWholeNumber } from '../goals/goalText';
import styles from './BookProgress.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');
const pages = (n: number) => `${numberFormat.format(n)} ${n === 1 ? 'page' : 'pages'}`;

interface BookProgressProps {
  book: Book;
  entry: ShelfEntry;
  /** Logging can move the book to another shelf; the page hears about it here. */
  onEntry: (entry: ShelfEntry) => void;
  /** Changes when the shelf changes elsewhere on the page, so the progress is fetched again. */
  refresh: number;
}

/** The reader's progress in a book on their shelves: where they are, logging a page, and the entries so far. */
export function BookProgress({ book, entry, onEntry, refresh }: BookProgressProps) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failed, setFailed] = useState<string | undefined>();
  const [by, setBy] = useState<'page' | 'percent'>('page');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const count = entry.pageCount ?? book.pageCount;

  useEffect(() => {
    let current = true;
    progressApi.get(book.id).then(
      (loaded) => current && setProgress(loaded),
      (problem: unknown) => current && setFailed(problemMessage(problem)),
    );
    return () => {
      current = false;
    };
  }, [book.id, refresh]);

  async function act(action: () => Promise<Progress>, describe: (result: Progress) => string, focusAfter?: string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setAnnouncement('');
    try {
      const result = await action();
      setProgress(result);
      onEntry(result.entry);
      setAnnouncement(describe(result));
      // When the button that was pressed goes away, the focus goes to something that stays.
      if (focusAfter) requestAnimationFrame(() => document.getElementById(focusAfter)?.focus());
    } catch (problem) {
      const errors = formErrorsFrom(problem, ['page', 'percent']);
      setError(errors.fields.page ?? errors.fields.percent ?? errors.general[0]);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = text.trim();
    const value = by === 'page' ? parseWholeNumber(typed) : Number(typed.replace(',', '.'));
    if (typed === '' || value === null || !Number.isFinite(value)) {
      setError(by === 'page' ? 'Enter the page you’ve reached as a number, such as 120.' : 'Enter the percentage as a number, such as 45.');
      return;
    }
    void act(
      () => progressApi.log(book.id, by === 'page' ? { page: value } : { percent: value }),
      (result) => {
        setText('');
        const latest = result.entries[0];
        if (!latest) return '';
        return latest.finished
          ? `Finished! ${book.title} is on your Finished shelf.`
          : `Logged page ${numberFormat.format(latest.page)}: ${pages(latest.pages)} read.`;
      },
    );
  }

  if (failed) return <Frame title="Your reading" className={styles.frame}><p>{failed}</p></Frame>;
  if (!progress) return null;
  const reading = progress.reading;
  const inProgress = reading !== null && reading.finishedOn === null;
  const percent = inProgress && count ? Math.min(100, Math.round((reading.page / count) * 100)) : null;

  return (
    <Frame title="Your reading" className={styles.frame}>
      <p id="progress-summary" tabIndex={-1} className={styles.summary}>
        {inProgress && (
          <>
            On page <strong>{numberFormat.format(reading.page)}</strong>
            {count ? ` of ${numberFormat.format(count)} (${percent}%)` : ''}, started {formatDay(reading.startedOn)}.
          </>
        )}
        {reading?.finishedOn && <>You finished it on {formatDay(reading.finishedOn)}. Log a page to read it again.</>}
        {!reading && <>Log the page you’ve reached, and the pages count towards your goal.</>}
      </p>
      {percent !== null && (
        <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className={styles.form}>
        {count !== null && (
          <Fieldset legend="Log by" className={styles.by}>
            <div className={styles.choices}>
              {(['page', 'percent'] as const).map((choice) => (
                <label key={choice} className={formStyles.radio}>
                  <input type="radio" name="by" value={choice} checked={by === choice} onChange={() => setBy(choice)} />
                  {choice === 'page' ? 'Page' : 'Percentage, for ebooks and audiobooks'}
                </label>
              ))}
            </div>
          </Fieldset>
        )}
        <div className={styles.row}>
          <TextField
            id="progress-value"
            name="reached"
            label={by === 'page' ? 'Page you’ve reached' : 'Percentage you’ve reached'}
            inputMode={by === 'page' ? 'numeric' : 'decimal'}
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            error={error}
          />
          <Button type="submit" aria-disabled={busy || undefined}>
            {busy ? 'Saving…' : 'Log progress'}
          </Button>
        </div>
      </form>

      <div className={styles.actions}>
        {inProgress && (
          <Button
            variant="secondary"
            aria-disabled={busy || undefined}
            onClick={() =>
              void act(() => progressApi.finish(book.id), () => `Finished! ${book.title} is on your Finished shelf.`, 'progress-summary')
            }
          >
            I’ve finished it
          </Button>
        )}
        {progress.entries.length > 0 && (
          <Button
            variant="secondary"
            aria-disabled={busy || undefined}
            onClick={() =>
              void act(
                () => progressApi.undo(book.id),
                () => 'The last entry is taken back.',
                progress.entries.length === 1 ? 'progress-value' : undefined,
              )
            }
          >
            Undo the last entry
          </Button>
        )}
      </div>
      <p role="status" className={styles.status}>
        {announcement}
      </p>

      {reading && progress.entries.length > 0 && (
        <>
          <h3 className={styles.heading}>{inProgress ? 'This reading' : 'The last reading'}</h3>
          <ol className={styles.log}>
            {progress.entries.map((item) => (
              <li key={item.id}>
                {formatDay(item.readOn)}: {item.finished ? 'finished' : `page ${numberFormat.format(item.page)}`}
                {item.pages > 0 && <span className={styles.pages}> · {pages(item.pages)}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {progress.earlierReadings.length > 0 && (
        <>
          <h3 className={styles.heading}>Read before</h3>
          <ul className={styles.log}>
            {progress.earlierReadings.map((earlier) => (
              <li key={earlier.id}>
                {formatDay(earlier.startedOn)} to {earlier.finishedOn ? formatDay(earlier.finishedOn) : 'not finished'}
              </li>
            ))}
          </ul>
        </>
      )}
    </Frame>
  );
}
