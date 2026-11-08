/** The site's address as readers see it, with the path the site is served under (the demo's /tomekeeper). */
export function siteAddress(path: string): string {
  return `${window.location.host}${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
}
