import { today } from '../dates';
import { apiRequest } from './client';
import type { ShelfEntry } from './shelves';

/** One time through a book. Dates are the reader's own, as yyyy-mm-dd. */
export interface Reading {
  id: string;
  startedOn: string;
  /** Null while the reading is in progress. */
  finishedOn: string | null;
  page: number;
}

export interface ProgressEntry {
  id: string;
  readOn: string;
  page: number;
  /** Pages read since the entry before. */
  pages: number;
  finished: boolean;
}

export interface Progress {
  /** The book on the shelves after the change; logging can move it to another shelf. */
  entry: ShelfEntry;
  /** The latest reading, in progress or finished. Null before the first entry. */
  reading: Reading | null;
  /** That reading's entries, newest first. */
  entries: ProgressEntry[];
  earlierReadings: Reading[];
}

const path = (bookId: string) => `/api/shelves/${encodeURIComponent(bookId)}/progress`;

export const progress = {
  get: (bookId: string) => apiRequest<Progress>('GET', path(bookId)),
  /** Logs the page reached, or a percentage (for ebooks and audiobooks). */
  log: (bookId: string, reached: { page: number } | { percent: number }) =>
    apiRequest<Progress>('POST', path(bookId), { ...reached, readOn: today() }),
  /** "I've finished it": the rest of the pages count today. */
  finish: (bookId: string) => apiRequest<Progress>('POST', `${path(bookId)}/finish`, { readOn: today() }),
  /** Takes back the latest entry. */
  undo: (bookId: string) => apiRequest<Progress>('DELETE', `${path(bookId)}/latest`),
};
