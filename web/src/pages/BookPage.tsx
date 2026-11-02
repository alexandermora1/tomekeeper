import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { books, type Book } from '../api/books';
import { shelves, type ShelfEntry, type ShelfId } from '../api/shelves';
import { BookCover } from '../components/BookCover';
import { Button } from '../components/Button';
import { formErrorsFrom, problemMessage } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Outcome } from '../components/Notice';
import { RemoveButton } from '../components/RemoveButton';
import { ShelfPicker } from '../components/ShelfPicker';
import { parseWholeNumber } from '../goals/goalText';
import { usePageTitle } from '../routing/usePageTitle';
import { onShelfMessage, shelfName } from '../shelves/shelfText';
import styles from './BookPage.module.css';
import { BookProgress } from './BookProgress';

const numberFormat = new Intl.NumberFormat('en-GB');
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

type PageState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; book: Book; entry: ShelfEntry | null }
  | { kind: 'deleted'; title: string };

/** A book from the catalogue: its details, and where it is on the reader's shelves. Address: /books/{id}. */
export function BookPage() {
  const { id = '' } = useParams();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  usePageTitle(state.kind === 'ready' ? state.book.title : state.kind === 'missing' ? 'Book not found' : 'A book');

  useEffect(() => {
    let current = true;
    Promise.all([books.get(id), shelves.get(id)]).then(
      ([book, entry]) => current && setState(book ? { kind: 'ready', book, entry } : { kind: 'missing' }),
      (error: unknown) => current && setState({ kind: 'failed', message: problemMessage(error) }),
    );
    return () => {
      current = false;
    };
  }, [id]);

  return (
    <Layout current="library">
      <p className={styles.back}>
        <Link to="/library">Back to the Library</Link>
      </p>
      {state.kind === 'loading' && <p className={styles.quiet}>Fetching the book…</p>}
      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>Book not found</h1>
          <p>There is no book at this address in Tomekeeper's catalogue. Find it in the Library instead.</p>
        </>
      )}
      {state.kind === 'failed' && (
        <>
          <h1 className={styles.title}>The book couldn't be fetched</h1>
          <p>{state.message}</p>
        </>
      )}
      {state.kind === 'ready' && (
        <BookDetails
          book={state.book}
          entry={state.entry}
          onEntry={(entry) => setState({ ...state, entry })}
          onDeleted={() => setState({ kind: 'deleted', title: state.book.title })}
        />
      )}
      {state.kind === 'deleted' && (
        <>
          <h1 className={styles.title}>Book deleted</h1>
          <Outcome>
            <p>
              <strong>{state.title}</strong> was only on your shelves, so it is gone from Tomekeeper now.
            </p>
            <Link to="/library">Go to the Library</Link>
          </Outcome>
        </>
      )}
    </Layout>
  );
}

interface BookDetailsProps {
  book: Book;
  entry: ShelfEntry | null;
  onEntry: (entry: ShelfEntry | null) => void;
  /** A book added by hand is deleted when it is removed from the shelves. */
  onDeleted: () => void;
}

function BookDetails({ book, entry, onEntry, onDeleted }: BookDetailsProps) {
  const byHand = book.openLibraryKey === null;
  // Moving the book can finish a reading, so the progress is fetched again after each move.
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState('');

  async function change(action: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setProblem(undefined);
    setAnnouncement('');
    try {
      setAnnouncement(await action());
    } catch (error) {
      setProblem(problemMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const choose = (shelf: ShelfId) =>
    change(async () => {
      const saved = await shelves.put(book.id, shelf);
      onEntry(saved);
      setMoves((n) => n + 1);
      return onShelfMessage(book.title, saved.shelf);
    });

  const remove = () =>
    change(async () => {
      await shelves.remove(book.id);
      if (byHand) {
        onDeleted();
        return '';
      }
      onEntry(null);
      // The Remove button is gone, so the focus goes to the line that now says the book is on no shelf.
      requestAnimationFrame(() => document.getElementById('book-shelf')?.focus());
      return `${book.title} is off your shelves.`;
    });

  return (
    <>
      <div className={styles.top}>
        <BookCover title={book.title} seed={book.openLibraryKey ?? book.id} coverId={book.coverId} large />
        <div className={styles.about}>
          <h1 className={styles.title}>{book.title}</h1>
          {book.subtitle && <p className={styles.subtitle}>{book.subtitle}</p>}
          <p className={styles.by}>by {book.authors.length > 0 ? book.authors.join(', ') : 'an unknown author'}</p>
          <dl className={styles.facts}>
            <dt>First published</dt>
            <dd>{book.firstPublishedYear ?? 'Not known'}</dd>
            <dt>Pages</dt>
            <dd>{pagesText(book, entry)}</dd>
            <dt>Source</dt>
            <dd>
              {book.openLibraryKey ? (
                <a href={`https://openlibrary.org/works/${book.openLibraryKey}`}>{book.title} on Open Library</a>
              ) : (
                'Added by you, by hand. Only you can see it.'
              )}
            </dd>
          </dl>
        </div>
      </div>

      <Frame title="On your shelves" className={styles.frame}>
        <p id="book-shelf" tabIndex={-1} className={styles.shelfLine}>
          {entry ? (
            <>
              On your <strong>{shelfName(entry.shelf)}</strong> shelf since {dateFormat.format(new Date(entry.shelvedAt))}.
            </>
          ) : (
            'Not on your shelves.'
          )}
        </p>
        <ShelfPicker title={book.title} current={entry?.shelf ?? null} busy={busy} error={problem} onChoose={(shelf) => void choose(shelf)}>
          {entry && (
            <RemoveButton
              title={book.title}
              pagesRead={entry.pagesRead}
              label={byHand ? 'Delete' : 'Remove'}
              busy={busy}
              onRemove={() => void remove()}
            />
          )}
        </ShelfPicker>
        {entry && (
          <PageCountForm
            book={book}
            entry={entry}
            onSaved={(saved) => {
              onEntry(saved);
              setAnnouncement(
                saved.pageCount === null
                  ? 'Saved. Tomekeeper uses the usual page count.'
                  : `Saved. Your edition has ${numberFormat.format(saved.pageCount)} pages.`,
              );
            }}
          />
        )}
        <p role="status" className={styles.status}>
          {announcement}
        </p>
      </Frame>
      {entry && <BookProgress book={book} entry={entry} onEntry={onEntry} refresh={moves} />}
    </>
  );
}

function pagesText(book: Book, entry: ShelfEntry | null): string {
  const usual = book.pageCount === null ? null : numberFormat.format(book.pageCount);
  if (entry?.pageCount) {
    return `${numberFormat.format(entry.pageCount)} in your edition${usual ? ` (usually ${usual})` : ''}`;
  }
  return usual ? `${usual}, a usual count across editions` : 'Not known';
}

interface PageCountFormProps {
  book: Book;
  entry: ShelfEntry;
  onSaved: (entry: ShelfEntry) => void;
}

/** The page count of the reader's own edition, which is what their progress will count against (stage 3). */
function PageCountForm({ book, entry, onSaved }: PageCountFormProps) {
  const [text, setText] = useState(entry.pageCount?.toString() ?? '');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const typed = text.trim();
    const pageCount = typed === '' ? null : parseWholeNumber(typed);
    if (typed !== '' && pageCount === null) {
      setError('Enter the number of pages as a whole number, such as 320, or leave it empty.');
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      onSaved(await shelves.setPageCount(book.id, pageCount));
    } catch (failure) {
      const errors = formErrorsFrom(failure, ['pageCount']);
      setError(errors.fields.pageCount ?? errors.general[0]);
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.pages}>
      <TextField
        id="page-count"
        name="pageCount"
        label="Pages in your edition"
        hint={
          book.pageCount === null
            ? "Open Library doesn't know the page count. Leave it empty if you don't either."
            : `Leave it empty to use the usual count, ${numberFormat.format(book.pageCount)}.`
        }
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={error}
      />
      <Button type="submit" variant="secondary" aria-disabled={pending || undefined}>
        {pending ? 'Saving…' : 'Save page count'}
      </Button>
    </form>
  );
}
