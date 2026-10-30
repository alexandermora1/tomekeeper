import { ApiError, apiRequest } from './client';

/** What a goal counts. */
export type GoalKind = 'pages' | 'books' | 'both';

/** A reader's goal for one calendar year. A number is null when the goal doesn't count it. */
export interface Goal {
  year: number;
  pages: number | null;
  books: number | null;
}

export interface GoalInput {
  kind: GoalKind;
  pages: number | null;
  books: number | null;
}

export const goals = {
  /** The goal for a year, or null when the reader hasn't set one. */
  async get(year: number): Promise<Goal | null> {
    try {
      return await apiRequest<Goal>('GET', `/api/goals/${year}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  /** Sets the goal for a year, or changes it. */
  put: (year: number, input: GoalInput) => apiRequest<Goal>('PUT', `/api/goals/${year}`, input),
};
