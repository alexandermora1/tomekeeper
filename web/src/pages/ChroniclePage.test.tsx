import { screen, within } from '@testing-library/react';
import type { Chronicle } from '../api/chronicle';
import type { Progress } from '../api/progress';
import type { ShelfEntry } from '../api/shelves';
import { fakeApi } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';
import { paceText } from './ChroniclePage';

const YEAR = new Date().getFullYear();
const ID = '01a1a000-0000-7000-8000-000000000001';
const dune: ShelfEntry = {
  book: { id: ID, openLibraryKey: 'OL893415W', title: 'Dune', subtitle: null, authors: ['Frank Herbert'], firstPublishedYear: 1965, pageCount: 604, coverId: null },
  shelf: 'reading',
  shelvedAt: '2026-11-01T12:00:00Z',
  pageCount: null,
  page: 120,
  pagesRead: 120,
};
const year = (changes: Partial<Chronicle> = {}): Chronicle => ({
  year: YEAR,
  goal: { year: YEAR, pages: 6000, books: 12 },
  pagesRead: 1500,
  booksFinished: 3,
  pagesByMonth: Array(12).fill(0),
  readingNow: [dune],
  character: { year: YEAR, xp: 1650, pagesXp: 1500, finishXp: 150, level: 3, title: 'Novice', levelStartsAt: 1150, nextLevelAt: 1800, titles: [] },
  ...changes,
});

describe('the chronicle', () => {
  beforeEach(() => {
    fakeApi.signedIn();
  });

  it('reckons pages and books against the goal', async () => {
    fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year() });
    renderApp('/');

    const reckoning = await screen.findByRole('region', { name: 'The Year’s Reckoning' });
    expect(await within(reckoning).findByRole('heading', { level: 3, name: 'Pages' })).toBeInTheDocument();
    expect(reckoning).toHaveTextContent('1,500 of 6,000 pages (25%)');
    expect(reckoning).toHaveTextContent('3 of 12 books (25%)');
    expect(reckoning).toHaveTextContent('a day from today reaches your goal.');
    expect(reckoning).toHaveTextContent(`Your goal for ${YEAR}: 6,000 pages and 12 books by 31 December.`);
    expect(within(reckoning).getByRole('link', { name: 'Level 3, Novice' })).toHaveAttribute('href', '/quests');
    expect(reckoning).toHaveTextContent('1,650 XP this year');
  });

  it('counts the year and offers a goal when there is none', async () => {
    fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year({ goal: null, readingNow: [] }) });
    renderApp('/');

    expect(await screen.findByText(/So far in/)).toHaveTextContent(`So far in ${YEAR}: 1,500 pages read and 3 books finished.`);
    expect(screen.getByRole('link', { name: 'Set your goal' })).toHaveAttribute('href', '/first-steps');
    expect(screen.getByRole('region', { name: 'Reading now' })).toHaveTextContent('Nothing on Reading now.');
  });

  it('still counts what a goal of pages alone leaves out', async () => {
    fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year({ goal: { year: YEAR, pages: 6000, books: null }, booksFinished: 1 }) });
    renderApp('/');
    expect(await screen.findByText('1 book finished so far.')).toBeInTheDocument();
  });

  it('says when the goal is reached', async () => {
    fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year({ pagesRead: 6100 }) });
    renderApp('/');
    expect(await screen.findByText('Goal reached. Every page from here is extra.')).toBeInTheDocument();
  });

  it('logs a page for a book on Reading now and counts it at once', async () => {
    fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year() });
    const logged: Progress = {
      entry: { ...dune, page: 150, pagesRead: 150 },
      reading: { id: 'r', startedOn: '2026-11-01', finishedOn: null, page: 150 },
      entries: [{ id: 'e', readOn: '2026-11-02', page: 150, pages: 30, finished: false }],
      earlierReadings: [],
    };
    fakeApi.on('POST', `/api/shelves/${ID}/progress`, () => {
      fakeApi.on('GET', `/api/chronicle/${YEAR}`, { status: 200, body: year({ pagesRead: 1530, readingNow: [logged.entry] }) });
      return { status: 200, body: logged };
    });
    const { user } = renderApp('/');

    const field = await screen.findByRole('textbox', { name: 'Page reached in Dune' });
    expect(screen.getByRole('list', { name: 'Books you are reading' })).toHaveTextContent('On page 120 of 604');
    await user.type(field, '150');
    await user.click(screen.getByRole('button', { name: 'Log Dune' }));

    expect(await screen.findByText('Logged page 150 in Dune: 30 pages read.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('region', { name: 'The Year’s Reckoning' })).toHaveTextContent('1,530 of 6,000 pages');
    expect(screen.getByRole('list', { name: 'Books you are reading' })).toHaveTextContent('On page 150 of 604');
    // The focus stays on the button that was pressed.
    expect(screen.getByRole('button', { name: 'Log Dune' })).toHaveFocus();
  });

  it('works out the pages a day to the end of the year', () => {
    expect(paceText(310, new Date(2026, 11, 1))).toBe('About 10 pages a day from today reaches your goal.');
    expect(paceText(1, new Date(2026, 11, 31))).toBe('About 1 page a day from today reaches your goal.');
  });
});
