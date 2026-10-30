import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchReader, type Reader } from '../api/account';
import { SessionContext, type Session, type SessionStatus } from './sessionContext';

/** Asks the API who is signed in when the site opens, and shares the answer with every page. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: SessionStatus; reader: Reader | null }>({
    status: 'loading',
    reader: null,
  });

  const setReader = useCallback((reader: Reader | null) => {
    setState({ status: reader ? 'signed-in' : 'signed-out', reader });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setReader(await fetchReader());
    } catch {
      // The API couldn't be reached. Show the site as signed out; signing in will then explain the problem.
      setReader(null);
    }
  }, [setReader]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const session = useMemo<Session>(() => ({ ...state, setReader, refresh }), [state, setReader, refresh]);
  return <SessionContext value={session}>{children}</SessionContext>;
}
