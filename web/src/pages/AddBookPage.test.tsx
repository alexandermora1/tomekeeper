import { screen } from '@testing-library/react';
import type { Book } from '../api/books';
import { fakeApi, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const ID = '01a1a000-0000-7000-8000-0000000000aa';
const recipes: Book = {
  id: ID,
  openLibraryKey: null,
  title: "Grandmother's Recipes",
  subtitle: null,
  authors: ['Ingrid Berg', 'Kari Berg'],
  firstPublishedYear: 1971,
  pageCount: 88,
  coverId: null,
};
const entry = { book: recipes, shelf: 'reading', shelvedAt: '2026-11-01T12:00:00Z', pageCount: null, page: null, pagesRead: 0 };

describe('adding a book by hand', () => {
  beforeEach(() => {
    fakeApi.signedIn();
    fakeApi.on('GET', '/api/shelves', { status: 200, body: { books: [] } });
  });

  it('is linked from the Library', async () => {
    renderApp('/library');
    expect(await screen.findByRole('link', { name: 'Add a book by hand' })).toHaveAttribute('href', '/library/add');
  });

  it('adds the book to the chosen shelf and opens its page', async () => {
    fakeApi.on('POST', '/api/books', { status: 201, body: entry });
    fakeApi.on('GET', `/api/books/${ID}`, { status: 200, body: recipes });
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: entry });
    const { user } = renderApp('/library/add');

    await user.type(await screen.findByLabelText('Title'), "Grandmother's Recipes");
    await user.type(screen.getByLabelText('Author'), 'Ingrid Berg, Kari Berg,');
    await user.type(screen.getByLabelText('Year first published (if you know it)'), '1971');
    await user.type(screen.getByLabelText('Pages (if you know them)'), '88');
    expect(screen.getByRole('radio', { name: 'Want to read' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Reading now' }));
    await user.click(screen.getByRole('button', { name: 'Add to your shelves' }));

    expect(await screen.findByRole('heading', { level: 1, name: "Grandmother's Recipes" })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/books/${ID}`);
    expect(fakeApi.sent('POST', '/api/books')[0]?.body).toEqual({
      title: "Grandmother's Recipes",
      subtitle: '',
      authors: ['Ingrid Berg', 'Kari Berg'],
      firstPublishedYear: 1971,
      pageCount: 88,
      shelf: 'reading',
    });
    expect(screen.getByText('Added by you, by hand. Only you can see it.')).toBeInTheDocument();
  });

  it('checks the numbers before sending, then shows what the API says', async () => {
    fakeApi.on('POST', '/api/books', validationProblem({ title: ['Enter the title.'] }));
    const { user } = renderApp('/library/add');

    await user.type(await screen.findByLabelText('Year first published (if you know it)'), 'long ago');
    await user.click(screen.getByRole('button', { name: 'Add to your shelves' }));
    expect(await screen.findByRole('link', { name: 'Enter the year as a number, such as 1971, or leave it empty.' })).toBeInTheDocument();
    expect(fakeApi.sent('POST', '/api/books')).toHaveLength(0);

    await user.clear(screen.getByLabelText('Year first published (if you know it)'));
    await user.click(screen.getByRole('button', { name: 'Add to your shelves' }));
    expect(await screen.findByRole('link', { name: 'Enter the title.' })).toHaveAttribute('href', '#title');
  });

  it('deletes the book when it is removed from the shelves, and says so', async () => {
    fakeApi.on('GET', `/api/books/${ID}`, { status: 200, body: recipes });
    fakeApi.on('GET', `/api/shelves/${ID}`, { status: 200, body: entry });
    fakeApi.on('DELETE', `/api/shelves/${ID}`, { status: 204 });
    const { user } = renderApp(`/books/${ID}`);

    await user.click(await screen.findByRole('button', { name: "Delete Grandmother's Recipes" }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Book deleted' })).toBeInTheDocument();
    expect(screen.getByText(/was only on your shelves/).parentElement).toHaveFocus();
  });
});
