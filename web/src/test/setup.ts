import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { fakeApi } from './fakeApi';

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

// jsdom doesn't scroll. The pages call these when moving between pages and to fields.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  fakeApi.reset();
  vi.stubGlobal('fetch', fakeApi.fetch);
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.__prefersDark = false;
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-script');
});
