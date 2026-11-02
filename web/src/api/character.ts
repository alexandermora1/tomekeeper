import { apiRequest } from './client';

export interface Title {
  name: string;
  from: number;
  /** Null for the highest title. */
  to: number | null;
}

/** XP and level for a year. 1 XP per page, and a quarter of a book's pages for finishing it. */
export interface Character {
  year: number;
  xp: number;
  pagesXp: number;
  finishXp: number;
  level: number;
  title: string;
  /** The XP where this level began. */
  levelStartsAt: number;
  /** The XP where the next level begins. */
  nextLevelAt: number;
  titles: Title[];
}

export const character = {
  get: (year: number) => apiRequest<Character>('GET', `/api/character/${year}`),
};
