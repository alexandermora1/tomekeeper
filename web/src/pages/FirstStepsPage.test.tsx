import { screen, within } from '@testing-library/react';
import type { Reader } from '../api/account';
import { fakeApi, sampleReader, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const YEAR = new Date().getFullYear();
const newReader: Reader = { ...sampleReader, displayName: 'Alex', email: 'alex@example.no', emailConfirmed: false, portrait: null };

describe('the first steps page', () => {
  beforeEach(() => {
    fakeApi.signedIn(newReader);
  });

  it('is where new readers go until they have chosen a goal and portrait', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: "Two choices, then you're in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/first-steps');
    expect(screen.getByText(/We sent a link to alex@example.no to confirm the address./)).toBeInTheDocument();
  });

  it('saves the goal and the portrait, then opens the chronicle', async () => {
    fakeApi
      .on('PUT', `/api/goals/${YEAR}`, { status: 200, body: { year: YEAR, pages: 2000, books: 7 } })
      .on('PUT', '/api/account/portrait', () => {
        const done: Reader = { ...newReader, portrait: 'knight' };
        fakeApi.signedIn(done);
        return { status: 200, body: done };
      });
    const { user } = renderApp('/first-steps');

    await user.click(await screen.findByRole('radio', { name: 'Both' }));
    await user.clear(screen.getByLabelText('Pages by 31 December'));
    await user.type(screen.getByLabelText('Pages by 31 December'), '2,000');
    await user.clear(screen.getByLabelText('Books by 31 December'));
    await user.type(screen.getByLabelText('Books by 31 December'), '7');
    await user.click(screen.getByRole('radio', { name: 'Knight' }));
    await user.click(screen.getByRole('button', { name: 'Begin your chronicle' }));

    expect(await screen.findByText(`Your goal is 2,000 pages and 7 books by 31 December ${YEAR}.`)).toBeInTheDocument();
    expect(fakeApi.sent('PUT', `/api/goals/${YEAR}`)[0]?.body).toEqual({ kind: 'both', pages: 2000, books: 7 });
    expect(fakeApi.sent('PUT', '/api/account/portrait')[0]?.body).toEqual({ portrait: 'knight' });

    fakeApi.on('GET', `/api/goals/${YEAR}`, { status: 200, body: { year: YEAR, pages: 2000, books: 7 } });
    await user.click(screen.getByRole('link', { name: 'Go to your chronicle' }));
    expect(await screen.findByText('2,000 pages and 7 books')).toBeInTheDocument();
  });

  it('only shows the numbers the goal counts, and keeps what was typed', async () => {
    const { user } = renderApp('/first-steps');

    const pages = await screen.findByLabelText('Pages by 31 December');
    expect(screen.queryByLabelText('Books by 31 December')).not.toBeInTheDocument();
    await user.clear(pages);
    await user.type(pages, '900');

    await user.click(screen.getByRole('radio', { name: 'Books' }));
    expect(screen.queryByLabelText('Pages by 31 December')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Books by 31 December')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Pages' }));
    expect(screen.getByLabelText('Pages by 31 December')).toHaveValue('900');
  });

  it('catches words typed where a number should be, without asking the API', async () => {
    const { user } = renderApp('/first-steps');

    const pages = await screen.findByLabelText('Pages by 31 December');
    await user.clear(pages);
    await user.type(pages, 'lots');
    await user.click(screen.getByRole('button', { name: 'Begin your chronicle' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(within(summary).getByRole('link', { name: 'Enter the number of pages in digits, like 1500.' })).toHaveAttribute(
      'href',
      '#goal-pages',
    );
    expect(fakeApi.sent('PUT', `/api/goals/${YEAR}`)).toHaveLength(0);
  });

  it('shows what the API says is missing', async () => {
    fakeApi.on('PUT', `/api/goals/${YEAR}`, validationProblem({ books: ['Enter how many books.'] }));
    const { user } = renderApp('/first-steps');

    await user.click(await screen.findByRole('radio', { name: 'Both' }));
    await user.clear(screen.getByLabelText('Books by 31 December'));
    await user.click(screen.getByRole('button', { name: 'Begin your chronicle' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText('Books by 31 December')).toHaveAccessibleDescription('Error: Enter how many books.');
    expect(fakeApi.sent('PUT', '/api/account/portrait')).toHaveLength(0);
  });

  it('groups the choices under their questions', async () => {
    renderApp('/first-steps');
    expect(await screen.findByRole('group', { name: 'Count your goal in' })).toBeInTheDocument();
    const portraits = screen.getByRole('group', { name: 'Choose your portrait' });
    expect(within(portraits).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'astrologer',
      'knight',
      'emperor',
    ]);
  });
});
