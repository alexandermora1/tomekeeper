import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('the site shell', () => {
  it('has a skip link to the main content', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('marks the current page in the main navigation', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Chronicle' }));
    expect(screen.getByRole('link', { name: 'Chronicle' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current');
  });

  it('has one page heading and a framed section', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tomekeeper' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Being built' })).toBeInTheDocument();
  });
});

describe('Dark theme toggle', () => {
  it('follows the device setting at first', () => {
    window.__prefersDark = true;
    render(<App />);
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('switches the theme and remembers the choice', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Dark theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('tomekeeper.theme')).toBe('dark');
  });

  it('keeps a stored choice over the device setting', () => {
    window.__prefersDark = true;
    localStorage.setItem('tomekeeper.theme', 'light');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Plain script toggle', () => {
  it('switches the display font setting and remembers it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Plain script' });

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-script', 'plain');
    expect(localStorage.getItem('tomekeeper.script')).toBe('plain');
  });
});
