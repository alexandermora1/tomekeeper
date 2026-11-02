import { screen, within } from '@testing-library/react';
import type { Book } from '../api/books';
import type { Progress } from '../api/progress';
import type { ShelfEntry } from '../api/shelves';
import { today } from '../dates';
import { fakeApi, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const ID = '01a1a000-0000-7000-8000-000000000001';
const dune: Book = {
  id: ID,
  openLibraryKey: 'OL893415W',
  title: 'Dune',
  subtitle: null,
  authors: ['Frank Herbert'],
  firstPublishedYear: 1965,
  pageCount: 604,
  coverId: 11481354,
  fiction: true,
};
const onShelf = (pageCount: number | null = null, page: number | null = null, pagesRead = 0): ShelfEntry => ({
  book: dune,
  shelf: 'reading',
  shelvedAt: '2026-11-01T12:00:00Z',
  pageCount,
  page,
  pagesRead,
  fiction: null,
  reviewed: false,
});
const PROGRESS = `/api/shelves/${ID}/progress`;
const REVIEWS = `/api/books/${ID}/reviews`;
const noProgress: Progress = { entry: onShelf(), reading: null, entries: [], earlierReadings: [] };
/** Progress on page 120, logged in two entries. */
const onPage120: Progress = {
  entry: onShelf(null, 120, 120),
  reading: { id: 'r1', startedOn: '2026-11-01', finishedOn: null, page: 120 },
  entries: [
    { id: 'e2', readOn: '2026-11-02', page: 120, pages: 80, finished: false },
    { id: 'e1', readOn: '2026-11-01', page: 40, pages: 40, finished: false },
  ],
  earlierReadings: [],
};

describe('the book page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', `/api/books/${ID}`, { status: 200, body: dune });
    fakeApi.on('GET', PROGRESS, { status: 200, body: noProgress });
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: null, others: [] } });
  });

  it("shows the book's details and its cover through Tomekeeper's API", async () => {
    renderApp(`/books/${ID}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dune' })).toBeInTheDocument();
    await vi.waitFor(() => expect(document.title).toBe('Dune – Tomekeeper'));
    expect(screen.getByText('by Frank Herbert')).toBeInTheDocument();
    expect(screen.getByText('604, a usual count across editions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dune on Open Library' })).toHaveAttribute('href', 'https://openlibrary.org/works/OL893415W');
    expect(document.querySelector('img[src="/api/covers/11481354?size=l"]')).toHaveAttribute('alt', '');
    expect(screen.getByText('Not on your shelves.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pages in your edition')).not.toBeInTheDocument();
  });

  it('puts the book on a shelf', async () => {
    fakeApi.on('PUT', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
    const { user } = renderApp(`/books/${ID}`);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Shelf for Dune' }), 'Reading now');
    await user.click(screen.getByRole('button', { name: 'Add Dune' }));

    expect(await screen.findByText('Dune is on your Reading now shelf.')).toHaveAttribute('role', 'status');
    expect(document.getElementById('book-shelf')).toHaveTextContent('On your Reading now shelf since 1 November 2026.');
    expect(screen.getByLabelText('Pages in your edition')).toBeInTheDocument();
  });

  it("saves the page count of the reader's edition", async () => {
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
    fakeApi.on('PUT', `/api/shelves/${ID}/page-count`, { status: 200, body: onShelf(512) });
    const { user } = renderApp(`/books/${ID}`);

    const field = await screen.findByLabelText('Pages in your edition');
    expect(field).toHaveAccessibleDescription('Leave it empty to use the usual count, 604.');
    await user.type(field, '512');
    await user.click(screen.getByRole('button', { name: 'Save page count' }));

    expect(await screen.findByText('Saved. Your edition has 512 pages.')).toBeInTheDocument();
    expect(fakeApi.sent('PUT', `/api/shelves/${ID}/page-count`)[0]?.body).toEqual({ pageCount: 512 });
    expect(screen.getByText('512 in your edition (usually 604)')).toBeInTheDocument();
  });

  it('explains a page count it cannot use', async () => {
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
    fakeApi.on('PUT', `/api/shelves/${ID}/page-count`, validationProblem({ pageCount: ['Enter a number of pages from 1 to 20,000, or leave it empty.'] }));
    const { user } = renderApp(`/books/${ID}`);

    const field = await screen.findByLabelText('Pages in your edition');
    await user.type(field, 'many');
    await user.click(screen.getByRole('button', { name: 'Save page count' }));
    expect(field).toHaveAccessibleDescription(/Error: Enter the number of pages as a whole number/);
    expect(fakeApi.sent('PUT', `/api/shelves/${ID}/page-count`)).toHaveLength(0);

    await user.clear(field);
    await user.type(field, '99999');
    await user.click(screen.getByRole('button', { name: 'Save page count' }));
    expect(await screen.findByText('Enter a number of pages from 1 to 20,000, or leave it empty.')).toBeInTheDocument();
  });

  it('takes the book off the shelves and moves the focus to the shelf line', async () => {
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
    fakeApi.on('DELETE', `/api/shelves/${ID}`, { status: 204 });
    const { user } = renderApp(`/books/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Remove Dune' }));

    expect(await screen.findByText('Dune is off your shelves.')).toBeInTheDocument();
    const line = screen.getByText('Not on your shelves.');
    await vi.waitFor(() => expect(line).toHaveFocus());
  });

  it('says so when there is no such book', async () => {
    renderApp('/books/not-a-book');

    expect(await screen.findByRole('heading', { level: 1, name: 'Book not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the Library' })).toHaveAttribute('href', '/library');
  });

  describe('progress', () => {
    beforeEach(() => {
      fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
    });

    it('logs the page reached and shows how far through the book that is', async () => {
      fakeApi.on('POST', PROGRESS, { status: 200, body: onPage120 });
      const { user } = renderApp(`/books/${ID}`);

      expect(await screen.findByText('Log the page you’ve reached, and the pages count towards your goal.')).toBeInTheDocument();
      await user.type(screen.getByLabelText('Page you’ve reached'), '120');
      await user.click(screen.getByRole('button', { name: 'Log progress' }));

      expect(await screen.findByText('Logged page 120: 80 pages read.')).toHaveAttribute('role', 'status');
      expect(fakeApi.sent('POST', PROGRESS)[0]?.body).toEqual({ page: 120, readOn: today() });
      expect(document.getElementById('progress-summary')).toHaveTextContent('On page 120 of 604 (20%), started 1 November 2026.');
      expect(screen.getByText('2 November 2026: page 120')).toBeInTheDocument();
    });

    it('logs a percentage for ebooks and audiobooks', async () => {
      fakeApi.on('POST', PROGRESS, { status: 200, body: onPage120 });
      const { user } = renderApp(`/books/${ID}`);

      await user.click(await screen.findByRole('radio', { name: 'Percentage, for ebooks and audiobooks' }));
      await user.type(screen.getByLabelText('Percentage you’ve reached'), '19,9');
      await user.click(screen.getByRole('button', { name: 'Log progress' }));

      await screen.findByText('Logged page 120: 80 pages read.');
      expect(fakeApi.sent('POST', PROGRESS)[0]?.body).toEqual({ percent: 19.9, readOn: today() });
    });

    it('shows what the API says about a page it cannot use', async () => {
      fakeApi.on('POST', PROGRESS, { status: 400, body: { title: 'x', status: 400, errors: { page: ['You’re already on page 120.'] } } });
      const { user } = renderApp(`/books/${ID}`);

      const field = await screen.findByLabelText('Page you’ve reached');
      await user.type(field, '90');
      await user.click(screen.getByRole('button', { name: 'Log progress' }));

      await vi.waitFor(() => expect(field).toHaveAccessibleDescription('Error: You’re already on page 120.'));
    });

    it('finishes the book and moves the focus to the summary', async () => {
      fakeApi.on('GET', PROGRESS, { status: 200, body: onPage120 });
      const finished: Progress = {
        ...onPage120,
        entry: { ...onShelf(null, null, 604), shelf: 'finished' },
        reading: { ...onPage120.reading!, finishedOn: '2026-11-02', page: 604 },
        entries: [{ id: 'e3', readOn: '2026-11-02', page: 604, pages: 484, finished: true }, ...onPage120.entries],
      };
      fakeApi.on('POST', `${PROGRESS}/finish`, { status: 200, body: finished });
      const { user } = renderApp(`/books/${ID}`);

      await user.click(await screen.findByRole('button', { name: 'I’ve finished it' }));

      expect(await screen.findByText('Finished! Dune is on your Finished shelf.')).toBeInTheDocument();
      expect(document.getElementById('book-shelf')).toHaveTextContent('On your Finished shelf');
      await vi.waitFor(() => expect(document.getElementById('progress-summary')).toHaveFocus());
      expect(screen.getByText('2 November 2026: finished')).toBeInTheDocument();
    });

    it('takes back the last entry', async () => {
      fakeApi.on('GET', PROGRESS, { status: 200, body: onPage120 });
      fakeApi.on('DELETE', `${PROGRESS}/latest`, {
        status: 200,
        body: { ...onPage120, reading: { ...onPage120.reading!, page: 40 }, entries: onPage120.entries.slice(1) },
      });
      const { user } = renderApp(`/books/${ID}`);

      await user.click(await screen.findByRole('button', { name: 'Undo the last entry' }));

      expect(await screen.findByText('The last entry is taken back.')).toBeInTheDocument();
      expect(document.getElementById('progress-summary')).toHaveTextContent('On page 40 of 604');
    });

    it('lets the reader say whether the book is fiction or nonfiction', async () => {
      fakeApi.on('PUT', `/api/shelves/${ID}/kind`, { status: 200, body: { ...onShelf(), fiction: false } });
      const { user } = renderApp(`/books/${ID}`);

      const group = await screen.findByRole('group', { name: 'Fiction or nonfiction?' });
      expect(group).toHaveAccessibleDescription('It decides which quests the pages count for. Tomekeeper’s guess from Open Library: fiction.');
      expect(screen.getByRole('radio', { name: 'Go by Tomekeeper’s guess' })).toBeChecked();
      await user.click(screen.getByRole('radio', { name: 'Nonfiction' }));
      await user.click(screen.getByRole('button', { name: 'Save choice' }));

      expect(await screen.findByText('Saved. Dune counts as nonfiction.')).toBeInTheDocument();
      expect(fakeApi.sent('PUT', `/api/shelves/${ID}/kind`)[0]?.body).toEqual({ fiction: false });
    });

    it('asks before removing a book with logged pages', async () => {
      fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf(null, 120, 120) });
      fakeApi.on('DELETE', `/api/shelves/${ID}`, { status: 204 });
      const { user } = renderApp(`/books/${ID}`);

      const remove = await screen.findByRole('button', { name: 'Remove Dune' });
      await user.click(remove);

      expect(fakeApi.sent('DELETE', `/api/shelves/${ID}`)).toHaveLength(0);
      expect(remove).toHaveAccessibleName('Yes, remove Dune');
      expect(remove).toHaveFocus();
      expect(remove).toHaveAccessibleDescription('This also deletes the 120 pages you logged.');
      await user.click(remove);
      expect(await screen.findByText('Dune is off your shelves.')).toBeInTheDocument();
    });
  });
});

describe('reviews on the book page', () => {
  const me = { handle: 'ingrid', displayName: 'Ingrid', portrait: 'knight' as const, relation: 'you' as const, since: null };
  const myReview = { reader: me, rating: 4, text: 'Sand everywhere.\nWorth it.', writtenAt: '2026-10-20T10:00:00Z', editedAt: null };

  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', `/api/books/${ID}`, { status: 200, body: dune });
    fakeApi.on('GET', PROGRESS, { status: 200, body: noProgress });
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: onShelf() });
  });

  it('writes a review with stars and words', async () => {
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: null, others: [] } });
    fakeApi.on('PUT', `/api/books/${ID}/review`, { status: 200, body: myReview });
    const { user } = renderApp(`/books/${ID}`);
    const reviews = await screen.findByRole('region', { name: 'Reviews' });

    await user.click(await within(reviews).findByRole('radio', { name: '4 stars' }));
    await user.type(within(reviews).getByRole('textbox', { name: 'Your review (if you like)' }), 'Sand everywhere.');
    await user.click(within(reviews).getByRole('button', { name: 'Save review' }));

    expect(await within(reviews).findByText('Review saved.')).toBeInTheDocument();
    expect(fakeApi.sent('PUT', `/api/books/${ID}/review`)[0]?.body).toEqual({ rating: 4, text: 'Sand everywhere.' });
    expect(within(reviews).getByRole('img', { name: '4 of 5 stars' })).toBeInTheDocument();
    expect(within(reviews).getByRole('button', { name: 'Edit review' })).toBeInTheDocument();
    await vi.waitFor(() => expect(within(reviews).getByRole('heading', { name: 'Your review' })).toHaveFocus());
  });

  it('needs a rating', async () => {
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: null, others: [] } });
    const { user } = renderApp(`/books/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Save review' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(within(summary).getByRole('link', { name: 'Choose from 1 to 5 stars.' })).toHaveAttribute('href', '#rating-1');
    expect(fakeApi.sent('PUT', `/api/books/${ID}/review`)).toHaveLength(0);
  });

  it('shows the reviews of others the reader may see', async () => {
    const tormod = { handle: 'tormod', displayName: 'Tormod', portrait: null, relation: 'friend' as const, since: null };
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: null, others: [{ ...myReview, reader: tormod, rating: 2, text: 'Too long.', editedAt: '2026-10-21T10:00:00Z' }] } });
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 404 });
    renderApp(`/books/${ID}`);

    const reviews = await screen.findByRole('region', { name: 'Reviews' });
    expect(await within(reviews).findByRole('link', { name: 'Tormod' })).toHaveAttribute('href', '/readers/tormod');
    expect(reviews).toHaveTextContent('Tormod · friend');
    expect(within(reviews).getByRole('img', { name: '2 of 5 stars' })).toBeInTheDocument();
    expect(reviews).toHaveTextContent('20 October 2026, edited');
    expect(reviews).toHaveTextContent('Too long.');
    expect(reviews).toHaveTextContent('Put the book on one of your shelves to review it.');
    expect(within(reviews).queryByRole('button', { name: 'Save review' })).not.toBeInTheDocument();
  });

  it('asks before deleting a review', async () => {
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: myReview, others: [] } });
    fakeApi.on('DELETE', `/api/books/${ID}/review`, { status: 204 });
    const { user } = renderApp(`/books/${ID}`);
    const reviews = await screen.findByRole('region', { name: 'Reviews' });

    await user.click(await within(reviews).findByRole('button', { name: 'Delete review' }));
    expect(within(reviews).getByRole('button', { name: 'Yes, delete your review' })).toHaveAccessibleDescription(
      'Delete your review? The words can’t be brought back.',
    );
    await user.click(within(reviews).getByRole('button', { name: 'Yes, delete your review' }));

    expect(await within(reviews).findByText('Review deleted.')).toBeInTheDocument();
    expect(fakeApi.sent('DELETE', `/api/books/${ID}/review`)).toHaveLength(1);
    expect(within(reviews).getByRole('radio', { name: '4 stars' })).not.toBeChecked();
  });

  it('edits a review, starting from what was written', async () => {
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: myReview, others: [] } });
    const { user } = renderApp(`/books/${ID}`);
    const reviews = await screen.findByRole('region', { name: 'Reviews' });

    await user.click(await within(reviews).findByRole('button', { name: 'Edit review' }));

    expect(within(reviews).getByRole('radio', { name: '4 stars' })).toBeChecked();
    expect(within(reviews).getByRole('textbox', { name: 'Your review (if you like)' })).toHaveValue('Sand everywhere.\nWorth it.');
    await user.click(within(reviews).getByRole('button', { name: 'Cancel' }));
    expect(within(reviews).getByRole('button', { name: 'Edit review' })).toBeInTheDocument();
  });

  it('warns that removing the book deletes the review', async () => {
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: { ...onShelf(), reviewed: true } });
    fakeApi.on('GET', REVIEWS, { status: 200, body: { mine: myReview, others: [] } });
    const { user } = renderApp(`/books/${ID}`);

    await user.click(await screen.findByRole('button', { name: 'Remove Dune' }));

    expect(screen.getByRole('button', { name: 'Yes, remove Dune' })).toHaveAccessibleDescription('This also deletes your review.');
    expect(fakeApi.sent('DELETE', `/api/shelves/${ID}`)).toHaveLength(0);
  });
});
