import type { Character } from './character';
import { apiRequest } from './client';
import type { Goal } from './goals';
import type { ShelfEntry } from './shelves';

/** The reader's year at a glance. */
export interface Chronicle {
  year: number;
  goal: Goal | null;
  /** Pages logged on the reader's own dates in the year. */
  pagesRead: number;
  /** Books finished in the year, re-reads included. */
  booksFinished: number;
  /** Pages per month, January first. */
  pagesByMonth: number[];
  /** The books on Reading now, latest first. */
  readingNow: ShelfEntry[];
  /** XP and level for the year. */
  character: Character;
}

export const chronicle = {
  get: (year: number) => apiRequest<Chronicle>('GET', `/api/chronicle/${year}`),
};
