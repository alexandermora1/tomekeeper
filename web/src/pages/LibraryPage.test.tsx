import { screen, within } from '@testing-library/react';
import type { Book, BookSearch } from '../api/books';
import type { ShelfEntry, ShelfId } from '../api/shelves';
import { today } from '../dates';
import { fakeApi, problem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const dune: BookSearch = {
  query: 'dune',
  total: 1,
  results: [
    {
      openLibraryKey: 'OL893415W',
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert'],
      firstPublishedYear: 1965,
      pageCount: 604,
      coverId: 11481354,
      editionCount: 12,
      bookId: null,
      shelf: null,
    },
  ],
};

describe('the Library page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/shelves', { status: 200, body: { books: [] } });
  });

  it('is the Library in the main navigation', async () => {
    renderApp('/library');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('The Library – Tomekeeper');
  });

  it('searches Open Library and lists what it found', async () => {
    fakeApi.on('GET', '/api/books/search', { status: 200, body: dune });
    const { user } = renderApp('/library');

    await user.type(await screen.findByRole('searchbox', { name: 'Title, author or ISBN' }), 'dune');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // The status line is there from the start; wait for the text in it.
    expect(await screen.findByText('1 book found for “dune”.')).toHaveAttribute('role', 'status');
    const results = screen.getByRole('list', { name: 'Books found for dune' });
    const item = within(results).getByRole('listitem');
    expect(within(item).getByRole('heading', { level: 3, name: 'Dune' })).toBeInTheDocument();
    expect(item).toHaveTextContent('Frank Herbert · 1965 · 604 pages');
    expect(window.location.search).toBe('?q=dune');
    expect(fakeApi.sent('GET', '/api/books/search')[0]?.search).toBe('?q=dune');
  });

  it('keeps the search in the address, so a reload or a link shows it again', async () => {
    fakeApi.on('GET', '/api/books/search', { status: 200, body: dune });
    renderApp('/library?q=dune');

    expect(await screen.findByRole('heading', { level: 3, name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Title, author or ISBN' })).toHaveValue('dune');
  });

  it('says so when nothing is found', async () => {
    fakeApi.on('GET', '/api/books/search', { status: 200, body: { query: 'xyzzy', total: 0, results: [] } });
    renderApp('/library?q=xyzzy');

    expect(await screen.findByText('No books found for “xyzzy”. Try fewer words, or another spelling.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Books found/ })).not.toBeInTheDocument();
  });

  it('says when there are more books than it shows', async () => {
    fakeApi.on('GET', '/api/books/search', { status: 200, body: { ...dune, query: 'herbert', total: 1234 } });
    renderApp('/library?q=herbert');

    expect(
      await screen.findByText('1,234 books found for “herbert”. Showing the first 1; add words to narrow it down.'),
    ).toHaveAttribute('role', 'status');
  });

  it('asks for at least two characters without searching', async () => {
    const { user } = renderApp('/library');

    await user.type(await screen.findByRole('searchbox', { name: 'Title, author or ISBN' }), 'd');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('searchbox')).toHaveAccessibleDescription('Error: Type a title, an author or an ISBN.');
    expect(fakeApi.sent('GET', '/api/books/search')).toHaveLength(0);
  });

  it('explains when Open Library is down', async () => {
    const down = "Open Library isn't answering right now, so books can't be searched. Try again in a little while.";
    fakeApi.on('GET', '/api/books/search', problem(503, down, 'Open Library is unavailable'));
    renderApp('/library?q=dune');

    expect(await screen.findByText(down)).toBeInTheDocument();
  });

  describe('shelves', () => {
    const DUNE_ID = '01a1a000-0000-7000-8000-000000000001';
    const duneBook: Book = { ...dune.results[0]!, id: DUNE_ID, openLibraryKey: 'OL893415W' };
    const entry = (book: Book, shelf: ShelfId): ShelfEntry => ({ book, shelf, shelvedAt: '2026-11-01T12:00:00Z', pageCount: null, page: null, pagesRead: 0 });
    const book = (n: number, title = `Book ${n}`): Book => ({
      ...duneBook,
      id: `01a1a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
      openLibraryKey: null,
      title,
    });

    function onShelves(...entries: ShelfEntry[]) {
      fakeApi.on('GET', '/api/shelves', { status: 200, body: { books: entries } });
    }

    function shelf(name: string) {
      return screen.getByRole('heading', { level: 3, name: new RegExp(`^${name} \\(\\d+\\)$`) }).parentElement!;
    }

    it('shows the four shelves, empty to begin with', async () => {
      renderApp('/library');

      await screen.findByRole('heading', { level: 3, name: 'Reading now (0)' });
      const frame = screen.getByRole('region', { name: 'Your shelves' });
      const headings = within(frame).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(headings).toEqual(['Reading now (0)', 'Want to read (0)', 'Finished (0)', 'Set aside (0)']);
      expect(within(frame).getByText('Books you are reading go here.')).toBeInTheDocument();
    });

    it('lists the books on each shelf', async () => {
      onShelves(entry(duneBook, 'reading'), entry(book(2, 'The Hobbit'), 'finished'), entry(book(3, 'Emma'), 'finished'));
      renderApp('/library');

      expect(await screen.findByRole('heading', { level: 3, name: 'Reading now (1)' })).toBeInTheDocument();
      const reading = within(shelf('Reading now')).getByRole('list', { name: 'Reading now' });
      expect(within(reading).getByRole('link', { name: 'Dune' })).toHaveAttribute('href', `/books/${DUNE_ID}`);
      expect(reading).toHaveTextContent('Frank Herbert · 1965 · 604 pages');
      const finished = within(shelf('Finished')).getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
      expect(finished).toEqual(['The Hobbit', 'Emma']);
      expect(within(shelf('Reading now')).getByRole('combobox', { name: 'Shelf for Dune' })).toHaveValue('reading');
    });

    it('adds a book from the search to the chosen shelf, saving it in the catalogue first', async () => {
      fakeApi.on('GET', '/api/books/search', { status: 200, body: dune });
      fakeApi.on('POST', '/api/books/open-library/OL893415W', { status: 201, body: duneBook });
      fakeApi.on('PUT', `/api/shelves/${DUNE_ID}`, { status: 200, body: entry(duneBook, 'reading') });
      const { user } = renderApp('/library?q=dune');

      const result = within(await screen.findByRole('list', { name: 'Books found for dune' })).getByRole('listitem');
      await user.selectOptions(within(result).getByRole('combobox', { name: 'Shelf for Dune' }), 'Reading now');
      await user.click(within(result).getByRole('button', { name: 'Add Dune' }));

      expect(await screen.findByText('Dune is on your Reading now shelf.')).toHaveAttribute('role', 'status');
      expect(fakeApi.sent('PUT', `/api/shelves/${DUNE_ID}`)[0]?.body).toEqual({ shelf: 'reading', readOn: today() });
      expect(result).toHaveTextContent('On your Reading now shelf');
      // The same button now moves the book, and does nothing until another shelf is chosen.
      expect(within(result).getByRole('button', { name: 'Move Dune' })).toHaveAttribute('aria-disabled', 'true');
      expect(within(shelf('Reading now')).getByRole('heading', { level: 4, name: 'Dune' })).toBeInTheDocument();
    });

    it('shelves a book that is already in the catalogue without adding it again', async () => {
      fakeApi.on('GET', '/api/books/search', { status: 200, body: { ...dune, results: [{ ...dune.results[0]!, bookId: DUNE_ID }] } });
      fakeApi.on('PUT', `/api/shelves/${DUNE_ID}`, { status: 200, body: entry(duneBook, 'wantToRead') });
      const { user } = renderApp('/library?q=dune');

      // "Want to read" is chosen to begin with.
      await user.click(await screen.findByRole('button', { name: 'Add Dune' }));

      expect(await screen.findByText('Dune is on your Want to read shelf.')).toBeInTheDocument();
      expect(fakeApi.sent('POST', '/api/books/open-library/OL893415W')).toHaveLength(0);
      expect(fakeApi.sent('PUT', `/api/shelves/${DUNE_ID}`)[0]?.body).toEqual({ shelf: 'wantToRead', readOn: today() });
    });

    it('shows which search results are on a shelf already', async () => {
      onShelves(entry(duneBook, 'finished'));
      fakeApi.on('GET', '/api/books/search', { status: 200, body: dune });
      renderApp('/library?q=dune');

      await screen.findByRole('heading', { level: 3, name: 'Finished (1)' });
      const result = within(await screen.findByRole('list', { name: 'Books found for dune' })).getByRole('listitem');
      expect(result).toHaveTextContent('On your Finished shelf');
      expect(within(result).getByRole('combobox', { name: 'Shelf for Dune' })).toHaveValue('finished');
    });

    it('moves a book to another shelf and keeps the focus on it', async () => {
      onShelves(entry(duneBook, 'reading'));
      fakeApi.on('PUT', `/api/shelves/${DUNE_ID}`, { status: 200, body: entry(duneBook, 'finished') });
      const { user } = renderApp('/library');

      await user.selectOptions(await screen.findByRole('combobox', { name: 'Shelf for Dune' }), 'Finished');
      await user.click(screen.getByRole('button', { name: 'Move Dune' }));

      expect(await screen.findByText('Dune is on your Finished shelf.')).toBeInTheDocument();
      const moved = within(shelf('Finished')).getByRole('heading', { level: 4, name: 'Dune' });
      expect(moved).toHaveFocus();
      expect(within(shelf('Reading now')).queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
    });

    it('takes a book off the shelves and puts the focus on the shelf it was on', async () => {
      onShelves(entry(duneBook, 'setAside'));
      fakeApi.on('DELETE', `/api/shelves/${DUNE_ID}`, { status: 204 });
      const { user } = renderApp('/library');

      await user.click(await screen.findByRole('button', { name: 'Remove Dune' }));

      expect(await screen.findByText('Dune is off your shelves.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Set aside (0)' })).toHaveFocus();
      expect(fakeApi.sent('DELETE', `/api/shelves/${DUNE_ID}`)).toHaveLength(1);
    });

    it('shows a problem next to the book when a change fails', async () => {
      const full = 'You have 10,000 books on your shelves, which is as many as Tomekeeper keeps. Remove some to add more.';
      fakeApi.on('GET', '/api/books/search', { status: 200, body: { ...dune, results: [{ ...dune.results[0]!, bookId: DUNE_ID }] } });
      fakeApi.on('PUT', `/api/shelves/${DUNE_ID}`, problem(409, full, 'Your shelves are full'));
      const { user } = renderApp('/library?q=dune');

      await user.click(await screen.findByRole('button', { name: 'Add Dune' }));

      expect(await screen.findByText(full)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Shelf for Dune' })).toHaveAccessibleDescription(`Error: ${full}`);
      expect(screen.getByRole('button', { name: 'Add Dune' })).not.toHaveAttribute('aria-disabled');
    });

    it('offers to try again when the shelves could not be fetched', async () => {
      fakeApi.on('GET', '/api/shelves', 'network-error');
      const { user } = renderApp('/library');

      const retry = await screen.findByRole('button', { name: 'Try again' });
      expect(screen.getByText(/Your shelves couldn't be fetched/)).toBeInTheDocument();
      onShelves(entry(duneBook, 'reading'));
      await user.click(retry);

      expect(await screen.findByRole('heading', { level: 4, name: 'Dune' })).toBeInTheDocument();
    });

    it('shows the first twelve books on a long shelf, and the rest when asked', async () => {
      onShelves(...Array.from({ length: 14 }, (_, i) => entry(book(i + 1), 'wantToRead')));
      const { user } = renderApp('/library');

      expect(await screen.findByRole('heading', { level: 3, name: 'Want to read (14)' })).toBeInTheDocument();
      expect(within(shelf('Want to read')).getAllByRole('listitem')).toHaveLength(12);
      const more = screen.getByRole('button', { name: 'Show all 14 on Want to read' });
      expect(more).toHaveAttribute('aria-expanded', 'false');

      await user.click(more);

      expect(within(shelf('Want to read')).getAllByRole('listitem')).toHaveLength(14);
      expect(screen.getByRole('button', { name: 'Show the first 12 on Want to read' })).toHaveFocus();
    });
  });
});
