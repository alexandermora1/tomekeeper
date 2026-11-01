import { screen, within } from '@testing-library/react';
import type { BookSearch } from '../api/books';
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
    },
  ],
};

describe('the Library page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
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
});
