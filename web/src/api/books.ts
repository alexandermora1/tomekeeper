import { ApiError, apiRequest } from './client';
import type { ShelfId } from './shelves';

/** A book in Tomekeeper's own catalogue. */
export interface Book {
  id: string;
  openLibraryKey: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  firstPublishedYear: number | null;
  pageCount: number | null;
  coverId: number | null;
}

/**
 * A book Open Library found. `bookId` is set when it is already in Tomekeeper's catalogue,
 * and `shelf` when it is on one of the reader's shelves.
 */
export interface BookSearchResult {
  openLibraryKey: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  firstPublishedYear: number | null;
  pageCount: number | null;
  coverId: number | null;
  editionCount: number | null;
  bookId: string | null;
  shelf: ShelfId | null;
}

export interface BookSearch {
  query: string;
  /** How many books Open Library found in all; only the first 20 come back. */
  total: number;
  results: BookSearchResult[];
}

/** A cover image, through Tomekeeper's API: "m" is about 180 pixels wide, "l" about 500. */
export const coverUrl = (coverId: number, size: 'm' | 'l') => `/api/covers/${coverId}?size=${size}`;

export const books = {
  search: (query: string) => apiRequest<BookSearch>('GET', `/api/books/search?q=${encodeURIComponent(query)}`),
  /** Saves an Open Library book in the catalogue (or finds it there) and returns it. */
  addFromOpenLibrary: (key: string) => apiRequest<Book>('POST', `/api/books/open-library/${encodeURIComponent(key)}`),
  async get(id: string): Promise<Book | null> {
    try {
      return await apiRequest<Book>('GET', `/api/books/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
