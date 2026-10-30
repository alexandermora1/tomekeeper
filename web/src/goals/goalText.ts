import type { Goal } from '../api/goals';

const numberFormat = new Intl.NumberFormat('en-GB');

/** "1,500 pages", "1 book", "1,500 pages and 4 books". */
export function describeGoal(goal: Pick<Goal, 'pages' | 'books'>): string {
  const parts: string[] = [];
  if (goal.pages !== null) parts.push(count(goal.pages, 'page'));
  if (goal.books !== null) parts.push(count(goal.books, 'book'));
  return parts.join(' and ');
}

function count(n: number, noun: string) {
  return `${numberFormat.format(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Reads a whole number the way people type it: "1500", "1 500", "1,500" or "1.500".
 * Gives null for anything else, such as "", "1.5" or "lots".
 */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // Thousands written with a space, a comma or a full stop between groups of three digits.
  if (/^\d{1,3}([  ,.]\d{3})+$/.test(trimmed)) return Number(trimmed.replace(/\D/g, ''));
  return null;
}

export const PAGES_PER_DAY = 20;
const PAGES_PER_BOOK = 300;

/**
 * A first goal to start from, for the rest of this year: about 20 pages a day until 31 December,
 * rounded to hundreds, and the number of books of about 300 pages that makes.
 */
export function suggestedGoal(today: Date): { pages: number; books: number } {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const end = Date.UTC(today.getFullYear(), 11, 31);
  const daysLeft = Math.round((end - start) / 86_400_000) + 1;
  const pages = Math.max(100, Math.round((daysLeft * PAGES_PER_DAY) / 100) * 100);
  return { pages, books: Math.max(1, Math.round(pages / PAGES_PER_BOOK)) };
}
