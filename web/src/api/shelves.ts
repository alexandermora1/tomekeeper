import { today } from '../dates';
import type { Book } from './books';
import { ApiError, apiRequest } from './client';

/** The four shelves every reader has. A book is on one of them at a time. */
export type ShelfId = 'reading' | 'wantToRead' | 'finished' | 'setAside';

/** A book on the reader's shelves. */
export interface ShelfEntry {
  book: Book;
  shelf: ShelfId;
  /** When the book was put on the shelf it is on now. */
  shelvedAt: string;
  /** The page count of the reader's own edition, if they have set one. */
  pageCount: number | null;
  /** The page reached in the reading in progress, or null when none is. */
  page: number | null;
  /** All pages logged for the book. Taking it off the shelves deletes them. */
  pagesRead: number;
  /** The reader's own say on fiction or nonfiction, if they gave one; otherwise the book's guess applies. */
  fiction: boolean | null;
}

const path = (bookId: string) => `/api/shelves/${encodeURIComponent(bookId)}`;

export const shelves = {
  /** Every book on the reader's shelves, the most recently shelved first. */
  list: async () => (await apiRequest<{ books: ShelfEntry[] }>('GET', '/api/shelves')).books,
  /**
   * Puts a book from the catalogue on a shelf, or moves it there from another one. Moving a book in progress
   * to Finished finishes it today.
   */
  put: (bookId: string, shelf: ShelfId) => apiRequest<ShelfEntry>('PUT', path(bookId), { shelf, readOn: today() }),
  /** One book on the reader's shelves, or null when it isn't on them. */
  async get(bookId: string): Promise<ShelfEntry | null> {
    try {
      return await apiRequest<ShelfEntry>('GET', path(bookId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  /** Sets the page count of the reader's own edition; null goes back to the book's usual count. */
  setPageCount: (bookId: string, pageCount: number | null) =>
    apiRequest<ShelfEntry>('PUT', `${path(bookId)}/page-count`, { pageCount }),
  /** Fiction (true) or nonfiction (false) in the reader's view, or null to go back to the book's guess. */
  setKind: (bookId: string, fiction: boolean | null) => apiRequest<ShelfEntry>('PUT', `${path(bookId)}/kind`, { fiction }),
  /** Takes a book off the reader's shelves. */
  remove: (bookId: string) => apiRequest('DELETE', path(bookId)),
};
