import { screen } from '@testing-library/react';
import type { Book } from '../api/books';
import type { ShelfEntry } from '../api/shelves';
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
};
const onShelf = (pageCount: number | null = null): ShelfEntry => ({
  book: dune,
  shelf: 'reading',
  shelvedAt: '2026-11-01T12:00:00Z',
  pageCount,
});

describe('the book page', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', `/api/books/${ID}`, { status: 200, body: dune });
  });

  it("shows the book's details and its cover through Tomekeeper's API", async () => {
    renderApp(`/books/${ID}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dune' })).toBeInTheDocument();
    expect(document.title).toBe('Dune – Tomekeeper');
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
});
