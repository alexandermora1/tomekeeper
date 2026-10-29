/**
 * Reader preferences that change how every page looks: light or dark theme, and the
 * decorative blackletter or "Plain script". They are stored per device in localStorage.
 *
 * index.html applies the same rules before the first paint. Keep the two in step.
 */

export type Theme = 'light' | 'dark';
export type Script = 'decorative' | 'plain';

export const THEME_KEY = 'tomekeeper.theme';
export const SCRIPT_KEY = 'tomekeeper.script';

/** A stored choice wins; with no choice, follow the device setting. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}

export function resolveScript(stored: string | null): Script {
  return stored === 'plain' ? 'plain' : 'decorative';
}

/** localStorage can be missing or throw (private windows, blocked site data). */
export function readStored(key: string, storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // The choice still applies for this visit; it just isn't remembered.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function applyToDocument(theme: Theme, script: Script, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-script', script);
}
