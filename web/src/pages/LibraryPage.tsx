import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { books, type BookSearch, type BookSearchResult } from '../api/books';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { OFFLINE_MESSAGE, SERVER_MESSAGE } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { MiniCover } from '../components/MiniCover';
import { Notice } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';
import styles from './LibraryPage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string }
  | { kind: 'found'; search: BookSearch }
  | { kind: 'failed'; query: string; message: string };

/**
 * The Library. For now: finding books on Open Library. Shelves (adding the books you find) come in step 2.2.
 * The search is in the address (?q=…), so the back button, reloading and sharing a link all keep it.
 */
export function LibraryPage() {
  usePageTitle('The Library');
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const state = useBookSearch(query);
  const [inputError, setInputError] = useState<string | undefined>();
  // What is in the box. It follows the address, so the back button brings the earlier search back into it.
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);

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

  return (
    <Layout current="library">
      <h1 className={styles.title}>The Library</h1>

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
          {statusText(state)}
        </p>

        {state.kind === 'found' && state.search.results.length > 0 && (
          <ul className={styles.results} aria-label={`Books found for ${state.search.query}`}>
            {state.search.results.map((result) => (
              <SearchResult key={result.openLibraryKey} result={result} />
            ))}
          </ul>
        )}

        <Notice className={styles.source}>
          Results come from <a href="https://openlibrary.org">Open Library</a>, the open catalogue of the Internet Archive. A
          book is saved in Tomekeeper's own catalogue the first time someone puts it on a shelf.
        </Notice>
      </Frame>
    </Layout>
  );
}

function SearchResult({ result }: { result: BookSearchResult }) {
  const details = [
    result.authors.length > 0 ? result.authors.slice(0, 3).join(', ') : 'Unknown author',
    result.firstPublishedYear?.toString(),
    result.pageCount ? `${numberFormat.format(result.pageCount)} pages` : null,
  ].filter(Boolean);

  return (
    <li className={styles.result}>
      <MiniCover title={result.title} seed={result.openLibraryKey} />
      <div className={styles.resultText}>
        <h3 className={styles.resultTitle}>
          {result.title}
          {result.subtitle && <span className={styles.subtitle}>: {result.subtitle}</span>}
        </h3>
        <p className={styles.resultMeta}>{details.join(' · ')}</p>
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
