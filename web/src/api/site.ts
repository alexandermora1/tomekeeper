import { useEffect, useState } from 'react';
import { apiRequest } from './client';

/** Who runs the site and where to write, from the deployment's settings. Null when not set (locally). */
export interface Site {
  operatorName: string | null;
  contactEmail: string | null;
}

export const site = {
  get: () => apiRequest<Site>('GET', '/api/site'),
};

/** The site's facts, or undefined while they load (or if the API can't be reached). */
export function useSite(): Site | undefined {
  const [found, setFound] = useState<Site | undefined>();
  useEffect(() => {
    let current = true;
    site.get().then(
      (loaded) => current && setFound(loaded),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);
  return found;
}
