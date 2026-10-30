import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * After moving to another page inside the site, starts the reader at the top of the new page and moves
 * keyboard focus to <main>. Without this, a screen reader stays on the link that was pressed, which is no
 * longer there, and doesn't announce the new page.
 *
 * Redirects that happen while the site opens (such as from the chronicle to the sign-in page) leave the
 * focus alone, so the first Tab still reaches the skip link.
 */
export function FocusOnNavigate() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef(pathname);
  const readerHasActed = useRef(false);

  useEffect(() => {
    const mark = () => {
      readerHasActed.current = true;
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    return () => {
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', mark, true);
    };
  }, []);

  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    if (navigationType === 'REPLACE' && !readerHasActed.current) return;

    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname, navigationType]);

  return null;
}
