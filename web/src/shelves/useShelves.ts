import { useCallback, useEffect, useState } from 'react';
import { shelves, type ShelfEntry } from '../api/shelves';
import { problemMessage } from '../components/forms/formErrors';

export type ShelvesState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; entries: ShelfEntry[] };

/**
 * The reader's shelves. They are loaded once; after that the page changes its own copy each time the API
 * has said yes to a change, instead of loading everything again.
 */
export function useShelves() {
  const [state, setState] = useState<ShelvesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    shelves.list().then(
      (entries) => current && setState({ kind: 'ready', entries }),
      (error: unknown) => current && setState({ kind: 'failed', message: problemMessage(error) }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  /** Puts a book first on its shelf, in place of where it was before. Latest first, as the API lists them. */
  const place = useCallback((entry: ShelfEntry) => {
    setState((state) =>
      state.kind === 'ready'
        ? { kind: 'ready', entries: [entry, ...state.entries.filter((e) => e.book.id !== entry.book.id)] }
        : state,
    );
  }, []);

  const drop = useCallback((bookId: string) => {
    setState((state) =>
      state.kind === 'ready' ? { kind: 'ready', entries: state.entries.filter((e) => e.book.id !== bookId) } : state,
    );
  }, []);

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, place, drop, reload };
}
