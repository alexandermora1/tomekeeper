import { useState } from 'react';
import type { ShelfEntry, ShelfId } from '../api/shelves';
import { bookDetails } from '../books/bookText';
import cardStyles from '../components/BookCard.module.css';
import { Button } from '../components/Button';
import formStyles from '../components/forms/forms.module.css';
import { Frame } from '../components/Frame';
import { MiniCover } from '../components/MiniCover';
import { ShelfPicker } from '../components/ShelfPicker';
import { SHELVES, type ShelfInfo } from '../shelves/shelfText';
import type { ShelvesState } from '../shelves/useShelves';
import styles from './LibraryShelves.module.css';

/** How many books a shelf shows before "Show all". */
export const SHOWN_AT_FIRST = 12;

/** Ids for the elements that take the focus after a change, because the button that was pressed is gone. */
export const shelfHeadingId = (shelf: ShelfId) => `shelf-${shelf}`;
export const shelvedBookId = (bookId: string) => `shelved-${bookId}`;

interface LibraryShelvesProps {
  state: ShelvesState;
  /** The book being saved, if any. */
  busyBookId: string | null;
  problem: { bookId: string; message: string } | null;
  onMove: (entry: ShelfEntry, shelf: ShelfId) => void;
  onRemove: (entry: ShelfEntry) => void;
  onRetry: () => void;
}

/** The reader's four shelves, each with its books, latest first. */
export function LibraryShelves({ state, busyBookId, problem, onMove, onRemove, onRetry }: LibraryShelvesProps) {
  return (
    <Frame title="Your shelves" className={styles.frame}>
      {state.kind === 'loading' && <p className={styles.quiet}>Fetching your shelves…</p>}
      {state.kind === 'failed' && (
        <div className={styles.failed}>
          <p className={formStyles.problem}>Your shelves couldn't be fetched. {state.message}</p>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      {state.kind === 'ready' &&
        SHELVES.map((shelf) => (
          <Shelf
            key={shelf.id}
            shelf={shelf}
            entries={state.entries.filter((entry) => entry.shelf === shelf.id)}
            busyBookId={busyBookId}
            problem={problem}
            onMove={onMove}
            onRemove={onRemove}
          />
        ))}
    </Frame>
  );
}

interface ShelfProps extends Pick<LibraryShelvesProps, 'busyBookId' | 'problem' | 'onMove' | 'onRemove'> {
  shelf: ShelfInfo;
  entries: ShelfEntry[];
}

function Shelf({ shelf, entries, busyBookId, problem, onMove, onRemove }: ShelfProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, SHOWN_AT_FIRST);

  return (
    <div className={styles.shelf}>
      <h3 id={shelfHeadingId(shelf.id)} tabIndex={-1} className={styles.shelfTitle}>
        {shelf.name} <span className={styles.count}>({entries.length})</span>
      </h3>
      {entries.length === 0 ? (
        <p className={styles.quiet}>{shelf.empty}</p>
      ) : (
        <ul className={cardStyles.list} aria-label={shelf.name}>
          {shown.map((entry) => (
            <ShelvedBook
              key={entry.book.id}
              entry={entry}
              busy={busyBookId === entry.book.id}
              error={problem?.bookId === entry.book.id ? problem.message : undefined}
              onMove={(to) => onMove(entry, to)}
              onRemove={() => {
                if (!busyBookId) onRemove(entry);
              }}
            />
          ))}
        </ul>
      )}
      {entries.length > SHOWN_AT_FIRST && (
        <Button variant="secondary" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className={styles.more}>
          {showAll ? `Show the first ${SHOWN_AT_FIRST}` : `Show all ${entries.length}`}
          {' '}
          <span className="visually-hidden">on {shelf.name}</span>
        </Button>
      )}
    </div>
  );
}

interface ShelvedBookProps {
  entry: ShelfEntry;
  busy: boolean;
  error: string | undefined;
  onMove: (shelf: ShelfId) => void;
  onRemove: () => void;
}

function ShelvedBook({ entry, busy, error, onMove, onRemove }: ShelvedBookProps) {
  const { book } = entry;
  return (
    <li className={cardStyles.card}>
      <MiniCover title={book.title} seed={book.openLibraryKey ?? book.id} />
      <div className={cardStyles.text}>
        <h4 id={shelvedBookId(book.id)} tabIndex={-1} className={cardStyles.title}>
          {book.title}
          {book.subtitle && <span className={cardStyles.subtitle}>: {book.subtitle}</span>}
        </h4>
        <p className={cardStyles.meta}>{bookDetails(book)}</p>
        <ShelfPicker
          title={book.title}
          current={entry.shelf}
          busy={busy}
          error={error}
          onChoose={onMove}
          className={cardStyles.wide}
        >
          <Button variant="secondary" aria-disabled={busy || undefined} onClick={onRemove}>
            Remove{' '}
            <span className="visually-hidden">{book.title}</span>
          </Button>
        </ShelfPicker>
      </div>
    </li>
  );
}
