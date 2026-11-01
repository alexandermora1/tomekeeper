import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { books, type BookSearch, type BookSearchResult } from '../api/books';
import { ApiError } from '../api/client';
import { shelves, type ShelfEntry, type ShelfId } from '../api/shelves';
import { bookDetails } from '../books/bookText';
import cardStyles from '../components/BookCard.module.css';
import { Button } from '../components/Button';
import { OFFLINE_MESSAGE, problemMessage, SERVER_MESSAGE } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { MiniCover } from '../components/MiniCover';
import { Notice } from '../components/Notice';
import { ShelfPicker } from '../components/ShelfPicker';
import { usePageTitle } from '../routing/usePageTitle';
import { onShelfMessage, shelfName } from '../shelves/shelfText';
import { useShelves } from '../shelves/useShelves';
import { LibraryShelves, shelfHeadingId, shelvedBookId } from './LibraryShelves';
import styles from './LibraryPage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string }
  | { kind: 'found'; search: BookSearch }
  | { kind: 'failed'; query: string; message: string };

/** Which book a change is for: a search result (by its Open Library key) or a book on a shelf (by its id). */
type Target = { kind: 'search'; key: string } | { kind: 'shelf'; bookId: string };

/**
 * The Library: finding books on Open Library and keeping them on the reader's four shelves.
 * The search is in the address (?q=…), so the back button, reloading and sharing a link all keep it.
 */
export function LibraryPage() {
  usePageTitle('The Library');
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const search = useBookSearch(query);
  const [inputError, setInputError] = useState<string | undefined>();
  // What is in the box. It follows the address, so the back button brings the earlier search back into it.
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);

  const { state: shelfState, place, drop, reload } = useShelves();
  // One change at a time: the book being saved, and the last problem, shown next to that book.
  const [busy, setBusy] = useState<Target | null>(null);
  const [problem, setProblem] = useState<{ target: Target; message: string } | null>(null);
  // Said by screen readers after each change. Sighted readers see the book itself change.
  const [announcement, setAnnouncement] = useState('');
  // After a book moves or goes, the button that was pressed is gone, so the focus goes here instead.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  }, [shelfState]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = text.trim();
    if (typed.length < 2) {
      setInputError('Type a title, an author or an ISBN.');
      return;
    }
    setInputError(undefined);
    setParams({ q: typed });
  }

  async function change(target: Target, action: () => Promise<string>) {
    if (busy) return;
    setBusy(target);
    setProblem(null);
    setAnnouncement('');
    try {
      setAnnouncement(await action());
    } catch (error) {
      focusNext.current = null;
      setProblem({ target, message: problemMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  /** The shelf a search result is on: from the shelves when they are loaded, since they change as the reader works. */
  function shelfOf(result: BookSearchResult): ShelfId | null {
    if (shelfState.kind !== 'ready') return result.shelf;
    return shelfState.entries.find((entry) => entry.book.openLibraryKey === result.openLibraryKey)?.shelf ?? null;
  }

  function addFromSearch(result: BookSearchResult, shelf: ShelfId) {
    return change({ kind: 'search', key: result.openLibraryKey }, async () => {
      // The first time anyone shelves a book, it goes into Tomekeeper's catalogue.
      const bookId = result.bookId ?? (await books.addFromOpenLibrary(result.openLibraryKey)).id;
      const entry = await shelves.put(bookId, shelf);
      place(entry);
      return onShelfMessage(entry.book.title, entry.shelf);
    });
  }

  function move(entry: ShelfEntry, shelf: ShelfId) {
    return change({ kind: 'shelf', bookId: entry.book.id }, async () => {
      const moved = await shelves.put(entry.book.id, shelf);
      focusNext.current = shelvedBookId(moved.book.id);
      place(moved);
      return onShelfMessage(moved.book.title, moved.shelf);
    });
  }

  function remove(entry: ShelfEntry) {
    return change({ kind: 'shelf', bookId: entry.book.id }, async () => {
      await shelves.remove(entry.book.id);
      focusNext.current = shelfHeadingId(entry.shelf);
      drop(entry.book.id);
      return `${entry.book.title} is off your shelves.`;
    });
  }

  const isSearch = (target: Target | null, key: string) => target?.kind === 'search' && target.key === key;
  const shelfTarget = (target: Target | null) => (target?.kind === 'shelf' ? target.bookId : null);

  return (
    <Layout current="library">
      <h1 className={styles.title}>The Library</h1>
      <p role="status" className="visually-hidden">
        {announcement}
      </p>

      <Frame title="Find a book">
        <form role="search" noValidate onSubmit={handleSubmit} className={styles.form}>
          <TextField
            id="library-q"
            name="q"
            type="search"
            label="Title, author or ISBN"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            error={inputError}
          />
          <Button type="submit" className={styles.searchButton}>
            Search
          </Button>
        </form>

        {/* Always in the page, so screen readers hear each new result count. */}
        <p role="status" className={styles.status}>
          {statusText(search)}
        </p>

        {search.kind === 'found' && search.search.results.length > 0 && (
          <ul className={cardStyles.list} aria-label={`Books found for ${search.search.query}`}>
            {search.search.results.map((result) => (
              <SearchResult
                key={result.openLibraryKey}
                result={result}
                shelf={shelfOf(result)}
                busy={isSearch(busy, result.openLibraryKey)}
                error={problem && isSearch(problem.target, result.openLibraryKey) ? problem.message : undefined}
                onAdd={(shelf) => void addFromSearch(result, shelf)}
              />
            ))}
          </ul>
        )}

        <Notice className={styles.source}>
          Results come from <a href="https://openlibrary.org">Open Library</a>, the open catalogue of the Internet Archive. A
          book is saved in Tomekeeper's own catalogue the first time someone puts it on a shelf.
        </Notice>
      </Frame>

      <LibraryShelves
        state={shelfState}
        busyBookId={shelfTarget(busy)}
        problem={problem?.target.kind === 'shelf' ? { bookId: problem.target.bookId, message: problem.message } : null}
        onMove={(entry, shelf) => void move(entry, shelf)}
        onRemove={(entry) => void remove(entry)}
        onRetry={reload}
      />
    </Layout>
  );
}

interface SearchResultProps {
  result: BookSearchResult;
  shelf: ShelfId | null;
  busy: boolean;
  error: string | undefined;
  onAdd: (shelf: ShelfId) => void;
}

function SearchResult({ result, shelf, busy, error, onAdd }: SearchResultProps) {
  return (
    <li className={cardStyles.card}>
      <MiniCover title={result.title} seed={result.openLibraryKey} />
      <div className={cardStyles.text}>
        <h3 className={cardStyles.title}>
          {result.title}
          {result.subtitle && <span className={cardStyles.subtitle}>: {result.subtitle}</span>}
        </h3>
        <p className={cardStyles.meta}>{bookDetails(result)}</p>
        {shelf && (
          <p className={cardStyles.onShelf}>
            On your <strong>{shelfName(shelf)}</strong> shelf
          </p>
        )}
        <ShelfPicker
          title={result.title}
          current={shelf}
          busy={busy}
          error={error}
          onChoose={onAdd}
          className={cardStyles.wide}
        />
      </div>
    </li>
  );
}

function statusText(state: SearchState): string {
  switch (state.kind) {
    case 'idle':
      return '';
    case 'searching':
      return `Searching Open Library for “${state.query}”…`;
    case 'failed':
      return state.message;
    case 'found': {
      const { total, results, query } = state.search;
      if (total === 0) return `No books found for “${query}”. Try fewer words, or another spelling.`;
      const count = total === 1 ? '1 book' : `${numberFormat.format(total)} books`;
      return total > results.length
        ? `${count} found for “${query}”. Showing the first ${results.length}; add words to narrow it down.`
        : `${count} found for “${query}”.`;
    }
  }
}

/** Searches whenever the query in the address changes. A newer search wins over a slower, older one. */
function useBookSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  useEffect(() => {
    if (query.length < 2) {
      setState({ kind: 'idle' });
      return;
    }
    let current = true;
    setState({ kind: 'searching', query });
    books
      .search(query)
      .then((search) => current && setState({ kind: 'found', search }))
      .catch((error: unknown) => current && setState({ kind: 'failed', query, message: searchProblem(error) }));
    return () => {
      current = false;
    };
  }, [query]);

  return state;
}

function searchProblem(error: unknown): string {
  if (error instanceof ApiError) return error.status === 503 || error.status === 429 || error.status === 400 ? error.message : SERVER_MESSAGE;
  return OFFLINE_MESSAGE;
}
