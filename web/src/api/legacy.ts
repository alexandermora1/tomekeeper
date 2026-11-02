import { apiRequest } from './client';

/** An attribute: one point per 500 pages of its kind, kept across years. */
export interface Attribute {
  name: string;
  /** What counts, such as "Fiction pages". */
  from: string;
  pages: number;
  value: number;
  /** Pages until the next point. */
  toNext: number;
}

/** A year, bound as a volume. The year going on is one too, still being written. */
export interface Volume {
  year: number;
  pages: number;
  books: number;
  level: number;
  /** Quests done that year, of six. */
  quests: number;
}

export interface Legacy {
  attributes: Attribute[];
  /** The newest first. */
  volumes: Volume[];
}

export const legacy = {
  get: () => apiRequest<Legacy>('GET', '/api/legacy'),
};
