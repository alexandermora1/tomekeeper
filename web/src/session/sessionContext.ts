import { createContext, useContext } from 'react';
import type { Reader } from '../api/account';

/** 'loading' only lasts until the first answer from /api/account/me. */
export type SessionStatus = 'loading' | 'signed-in' | 'signed-out';

export interface Session {
  status: SessionStatus;
  /** The signed-in reader, or null. */
  reader: Reader | null;
  /**
   * Call this right after signing in, signing up or signing out, in the same event handler as any
   * `navigate()`, so React shows the new page and the new session together.
   */
  setReader: (reader: Reader | null) => void;
  /** Asks the API again, for example after the reader confirms their email. */
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

/** Who is signed in. Only works inside <SessionProvider>. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>.');
  return session;
}
