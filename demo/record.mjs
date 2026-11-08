// Records what the API answers on every page of the demo, signed in as Alex, into web/src/demo/recording.json.
// Run it after seed.mjs, with the same API and stand-in Open Library running (see demo/README.md):
//
//   API=http://localhost:5080 node demo/record.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const API = process.env.API ?? 'http://localhost:5080';
const PASSWORD = 'lantern harbour winter quill';
const catalogue = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8'));
const FRIENDS = ['jonas', 'ingrid', 'marius', 'sofie', 'henrik', 'eirik'];
let cookie = '';

async function call(method, path, body) {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tomekeeper-Request': '1', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of response.headers.getSetCookie?.() ?? []) if (c.startsWith('tomekeeper.auth=')) cookie = c.split(';')[0];
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const responses = {};
async function record(path) {
  const answer = await call('GET', path);
  if (answer.status >= 500) throw new Error(`${path} → ${answer.status}`);
  responses[path] = answer;
  return answer.body;
}

const signIn = await call('POST', '/api/account/sign-in', { email: 'alex@demo.tomekeeper.invalid', password: PASSWORD });
if (signIn.status >= 300) throw new Error(`Couldn't sign in as Alex: ${signIn.status}. Run seed.mjs first.`);

// The demo's today is the day it was recorded.
const today = new Date().toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));

for (const path of ['/api/account/me', '/api/account/sign-in-options', '/api/site', '/api/shelves', '/api/fellowship', '/api/profile', '/api/legacy']) {
  await record(path);
}
for (const y of [year - 2, year - 1, year]) {
  for (const kind of ['goals', 'chronicle', 'character', 'quests']) await record(`/api/${kind}/${y}`);
}
await record('/api/goals/' + (year + 1));
for (const handle of ['alex', ...FRIENDS]) await record(`/api/readers/${handle}`);
for (const as of ['friend', 'stranger']) await record(`/api/readers/alex?as=${as}`);

// Search, answered in the browser from these lists: every book in the catalogue as a search result (with
// Alex's shelf), and every demo reader as a reader card.
const books = new Map();
for (const book of catalogue) {
  const found = await call('GET', `/api/books/search?q=${encodeURIComponent(book.title)}`);
  for (const result of found.body.results) books.set(result.openLibraryKey, result);
}
const searchTemplate = (await call('GET', `/api/books/search?q=${encodeURIComponent(catalogue[0].title)}`)).body;
const readers = new Map();
for (const handle of ['alex', ...FRIENDS]) {
  const found = await call('GET', `/api/readers?q=${encodeURIComponent(handle)}`);
  for (const card of found.body.readers) readers.set(card.handle, card);
}

// Every book page: the book, Alex's shelf (404 when it isn't on one), the reading and the reviews.
for (const result of books.values()) {
  if (!result.bookId) continue;
  const id = result.bookId;
  await record(`/api/books/${id}`);
  const shelf = await record(`/api/shelves/${id}`);
  if (shelf) await record(`/api/shelves/${id}/progress`);
  await record(`/api/books/${id}/reviews`);
}

const recording = {
  today,
  recordedAt: new Date().toISOString(),
  searchFields: Object.fromEntries(Object.entries(searchTemplate).filter(([key]) => !['query', 'total', 'results'].includes(key))),
  books: [...books.values()],
  readers: [...readers.values()],
  responses,
};
const file = new URL('../web/src/demo/recording.json', import.meta.url);
writeFileSync(file, JSON.stringify(recording));
console.log(`Recorded ${Object.keys(responses).length} answers, ${books.size} books and ${readers.size} readers, as of ${today}.`);
