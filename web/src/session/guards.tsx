import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from './sessionContext';

/** Shows the page only to signed-in readers. Others go to the sign-in page and come back here afterwards. */
export function RequireReader({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') return null;
  if (status === 'signed-out') return <Navigate to="/sign-in" replace state={{ from: location }} />;
  return children;
}

/** The sign-in and sign-up pages are only for readers who aren't signed in yet. */
export function RequireSignedOut({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') return null;
  if (status === 'signed-in') return <Navigate to={returnPath(location.state)} replace />;
  return children;
}

/**
 * Where to go after signing in: the page the reader was sent away from, or the chronicle.
 * RequireReader puts that page in the location state as `from`.
 */
export function returnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/';
  const from = state.from;
  if (typeof from !== 'object' || from === null || !('pathname' in from) || typeof from.pathname !== 'string') return '/';
  const search = 'search' in from && typeof from.search === 'string' ? from.search : '';
  // Only paths on this site.
  return from.pathname.startsWith('/') && !from.pathname.startsWith('//') ? from.pathname + search : '/';
}
