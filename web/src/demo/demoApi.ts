import type { BookSearch, BookSearchResult } from '../api/books';
import { ApiError, type ProblemDetails } from '../api/client';
import type { ReaderCard } from '../api/fellowship';
import { freezeClock } from './clock';
import recording from './recording.json';

/**
 * The demo's stand-in for the API: what the real API answered on every page, signed in as Alex, recorded by
 * demo/record.mjs. Searches are answered from the recorded books and readers. Nothing can be changed.
 */

interface Answer {
  status: number;
  body: unknown;
}

const responses = recording.responses as Record<string, Answer>;
const books = recording.books as BookSearchResult[];
const readers = recording.readers as ReaderCard[];

/** The day the demo was recorded. The clock stands still on it. */
export const DEMO_TODAY: string = recording.today;

export const DEMO_MESSAGE = 'This is a demo, so nothing is saved. Everything else works as on the real site.';

/** Starts the demo: the clock stops at the recorded day. */
export function startDemo(): void {
  freezeClock(DEMO_TODAY);
}

/** Answers a request as the API would have, or refuses a change. */
export async function demoAnswer(method: string, path: string): Promise<unknown> {
  // A moment's wait, like a real server, so the pages show their loading states as they would.
  await new Promise((resolve) => setTimeout(resolve, 60));
  if (method !== 'GET') throw new ApiError(403, { title: 'This is a demo', status: 403, detail: DEMO_MESSAGE });

  const url = new URL(path, 'https://demo.invalid');
  if (url.pathname === '/api/books/search') return searchBooks(url.searchParams.get('q') ?? '');
  if (url.pathname === '/api/readers') return { readers: searchReaders(url.searchParams.get('q') ?? '') };

  const answer = responses[path];
  if (!answer) throw new ApiError(404, { title: 'Not found', status: 404, detail: 'There is nothing at this address in the demo.' });
  if (answer.status >= 400) throw new ApiError(answer.status, answer.body as ProblemDetails);
  return structuredClone(answer.body);
}

/** Letters only, without accents, so "godel" finds "Gödel" as Open Library would. */
const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function tooShort(field: string, message: string): never {
  throw new ApiError(400, { title: 'Some fields need attention.', status: 400, errors: { [field]: [message] } });
}

export function searchBooks(query: string): BookSearch {
  const q = plain(query.trim());
  if (q.length < 2) tooShort('q', 'Type at least 2 letters of a title, an author or an ISBN.');
  const results = books.filter((book) => [book.title, book.subtitle ?? '', ...book.authors].some((text) => plain(text).includes(q)));
  return { query: query.trim(), total: results.length, results: structuredClone(results.slice(0, 20)) };
}

export function searchReaders(query: string): ReaderCard[] {
  const q = plain(query.trim());
  if (q.length < 2) tooShort('q', 'Type at least 2 letters of a name or address.');
  return structuredClone(readers.filter((reader) => plain(reader.displayName).includes(q) || reader.handle.includes(q)));
}
