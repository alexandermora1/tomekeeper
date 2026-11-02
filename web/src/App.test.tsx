import { screen, waitFor } from '@testing-library/react';
import { fakeApi } from './test/fakeApi';
import { renderApp } from './test/renderApp';

describe('the site shell', () => {
  it('has a skip link to the main content', async () => {
    renderApp('/sign-in');
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('marks the current page in the main navigation for a signed-in reader', async () => {
    fakeApi.signedIn();
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Chronicle' }));
    expect(screen.getByRole('link', { name: 'Chronicle' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current');
  });

  it('shows the chronicle with one page heading and a framed section', async () => {
    fakeApi.signedIn();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your chronicle' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'The Year’s Reckoning' })).toBeInTheDocument();
    await vi.waitFor(() => expect(document.title).toBe('Your chronicle – Tomekeeper'));
  });

  it('sends visitors who are not signed in to the sign-in page', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/sign-in');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('sends signed-in readers away from the sign-in page', async () => {
    fakeApi.signedIn();
    renderApp('/sign-in');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your chronicle' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('shows a page for addresses that do not exist', async () => {
    renderApp('/no-such-page');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('signs out from the header', async () => {
    fakeApi.signedIn().on('POST', '/api/account/sign-out', { status: 204 });
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('status')).toHaveTextContent("You're signed out.");
    expect(window.location.pathname).toBe('/sign-in');
    expect(fakeApi.sent('POST', '/api/account/sign-out')).toHaveLength(1);
  });

  it('moves focus to the new page after following a link', async () => {
    const { user } = renderApp('/sign-in');
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    await vi.waitFor(() => expect(document.title).toBe('Create an account – Tomekeeper'));
  });
});

describe('Dark theme toggle', () => {
  it('follows the device setting at first', async () => {
    window.__prefersDark = true;
    renderApp('/sign-in');
    expect(await screen.findByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
    // The page appears once the session has loaded; the theme is set on <html> just after that render.
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
  });

  it('switches the theme and remembers the choice', async () => {
    const { user } = renderApp('/sign-in');
    const toggle = await screen.findByRole('button', { name: 'Dark theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('tomekeeper.theme')).toBe('dark');
  });

  it('keeps a stored choice over the device setting', async () => {
    window.__prefersDark = true;
    localStorage.setItem('tomekeeper.theme', 'light');
    renderApp('/sign-in');
    expect(await screen.findByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Plain script toggle', () => {
  it('switches the display font setting and remembers it', async () => {
    const { user } = renderApp('/sign-in');
    const toggle = await screen.findByRole('button', { name: 'Plain script' });

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-script', 'plain');
    expect(localStorage.getItem('tomekeeper.script')).toBe('plain');
  });
});
