import type { Book } from './books';
import { apiRequest } from './client';

/** The four shelves every reader has. A book is on one of them at a time. */
export type ShelfId = 'reading' | 'wantToRead' | 'finished' | 'setAside';

/** A book on the reader's shelves. */
export interface ShelfEntry {
  book: Book;
  shelf: ShelfId;
  /** When the book was put on the shelf it is on now. */
  shelvedAt: string;
}

const path = (bookId: string) => `/api/shelves/${encodeURIComponent(bookId)}`;

export const shelves = {
  /** Every book on the reader's shelves, the most recently shelved first. */
  list: async () => (await apiRequest<{ books: ShelfEntry[] }>('GET', '/api/shelves')).books,
  /** Puts a book from the catalogue on a shelf, or moves it there from another one. */
  put: (bookId: string, shelf: ShelfId) => apiRequest<ShelfEntry>('PUT', path(bookId), { shelf }),
  /** Takes a book off the reader's shelves. */
  remove: (bookId: string) => apiRequest('DELETE', path(bookId)),
};
