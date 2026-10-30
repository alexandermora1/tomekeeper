import { useEffect } from 'react';

/** Sets the browser tab title, which is also the first thing a screen reader announces for a page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – Tomekeeper`;
  }, [title]);
}
