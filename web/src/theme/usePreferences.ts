import { useCallback, useEffect, useState } from 'react';
import {
  SCRIPT_KEY,
  THEME_KEY,
  applyToDocument,
  readStored,
  resolveScript,
  resolveTheme,
  systemPrefersDark,
  writeStored,
  type Script,
  type Theme,
} from './preferences';

export interface Preferences {
  theme: Theme;
  script: Script;
  toggleTheme: () => void;
  toggleScript: () => void;
}

export function usePreferences(): Preferences {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readStored(THEME_KEY), systemPrefersDark()));
  const [script, setScript] = useState<Script>(() => resolveScript(readStored(SCRIPT_KEY)));

  useEffect(() => {
    applyToDocument(theme, script);
  }, [theme, script]);

  // Follow the device setting while the reader hasn't chosen a theme on this site.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (readStored(THEME_KEY) === null) setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      writeStored(THEME_KEY, next);
      return next;
    });
  }, []);

  const toggleScript = useCallback(() => {
    setScript((current) => {
      const next: Script = current === 'plain' ? 'decorative' : 'plain';
      writeStored(SCRIPT_KEY, next);
      return next;
    });
  }, []);

  return { theme, script, toggleTheme, toggleScript };
}
