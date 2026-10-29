import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no matchMedia. Tests can set `window.__prefersDark` to pretend the device is in dark mode.
declare global {
  interface Window {
    __prefersDark?: boolean;
  }
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('dark') ? Boolean(window.__prefersDark) : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.__prefersDark = false;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-script');
});
