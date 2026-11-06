// Makes the demo's example readers in a fresh database, through the real API, then moves their dates back so they
// have years of history. The API only takes reading dates near today, so everything is logged today and then
// shifted in one SQL file (demo/out/shift-dates.sql). See demo/README.md for how to run it.
//
//   API=http://localhost:5080 DEMO_TODAY=2026-11-06 node demo/seed.mjs
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const API = process.env.API ?? 'http://localhost:5080';
const DATABASE_URL = process.env.DEMO_DATABASE_URL ?? 'postgresql://tomekeeper:tomekeeper_dev@localhost:5432/tomekeeper_demo';
// Without psql on the machine, a command that runs it elsewhere, reading the SQL from standard input, such as
// DEMO_PSQL="docker compose exec -T db psql -U tomekeeper -d tomekeeper_demo".
const PSQL = process.env.DEMO_PSQL;
const TODAY = process.env.DEMO_TODAY ?? new Date().toISOString().slice(0, 10);
const Y = Number(TODAY.slice(0, 4));
const realToday = new Date().toISOString().slice(0, 10);
const catalogue = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8'));
const book = (id) => catalogue.find((b) => b.id === id) ?? fail(`No book ${id}`);
const keyOf = (id) => `OL${9000001 + catalogue.findIndex((b) => b.id === id)}W`;
function fail(message) { throw new Error(message); }

// Dates as "Y-MM-DD" (this year), "Y1-…" (last year) or "Y2-…"; never after the demo's today.
const date = (d) => {
  const full = d.replace(/^Y2/, Y - 2).replace(/^Y1/, Y - 1).replace(/^Y/, Y);
  return full > TODAY ? TODAY : full;
};
const addDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

/** A reader, with the cookie that keeps them signed in. */
class Reader {
  constructor(spec) { this.spec = spec; this.cookie = ''; this.books = new Map(); }
  async call(method, path, body) {
    const response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Tomekeeper-Request': '1', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.getSetCookie?.() ?? [];
    for (const c of set) if (c.startsWith('tomekeeper.auth=')) this.cookie = c.split(';')[0];
    const text = await response.text();
    if (!response.ok) fail(`${this.spec.name}: ${method} ${path} → ${response.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  async bookId(id) {
    if (!this.books.has(id)) this.books.set(id, (await this.call('POST', `/api/books/open-library/${keyOf(id)}`)).id);
    return this.books.get(id);
  }
}

// What each reader has read. `from`–`to` is when they read it; `page` stops short of the end (reading now, or set aside).
const ALEX = {
  name: 'Alex', handle: 'alex', portrait: 'astrologer', since: 'Y2-01-05',
  bio: 'Mostly fantasy, some history, and the odd book about technology and society. Slowly working through the Malazan books.',
  goals: { [Y]: 8000, [Y - 1]: 5000, [Y - 2]: 3000 },
  visibility: { reading: 'everyone' },
  books: [
    ['tcmc', 'Y2-02-01', 'Y2-03-20'], ['neu', 'Y2-04-02', 'Y2-04-12'], ['mar', 'Y2-05-03', 'Y2-05-15'], ['edu', 'Y2-06-01', 'Y2-06-18'],
    ['nc', 'Y2-07-05', 'Y2-07-25'], ['phm', 'Y2-09-01', 'Y2-09-20'],
    ['hob', 'Y1-01-03', 'Y1-01-12'], ['dune', 'Y1-01-15', 'Y1-02-10'], ['gg', 'Y1-02-14', 'Y1-02-25'], ['woe', 'Y1-03-02', 'Y1-03-07'],
    ['sap', 'Y1-03-10', 'Y1-04-05'], ['tfs', 'Y1-04-10', 'Y1-05-12'], ['pote', 'Y1-05-20', 'Y1-07-10'], ['llr', 'Y1-07-15', 'Y1-08-05'],
    ['wh', 'Y1-08-10', 'Y1-09-20'], ['gotm', 'Y1-10-01', 'Y1-11-15'],
    ['fotr', 'Y-01-02', 'Y-01-14'], ['f451', 'Y-01-15', 'Y-01-20'], ['tt', 'Y-01-22', 'Y-02-08'], ['rotk', 'Y-02-09', 'Y-02-25'],
    ['dg', 'Y-02-26', 'Y-03-28'], ['chip', 'Y-03-08', 'Y-03-30'], ['sotw', 'Y-04-02', 'Y-04-20'], ['cw', 'Y-04-14', 'Y-04-29'],
    ['col', 'Y-05-01', 'Y-05-27'], ['gp', 'Y-05-18', 'Y-05-31'], ['thud', 'Y-06-04', 'Y-06-23'], ['bs', 'Y-07-02', 'Y-07-26'],
    ['eai', 'Y-08-03', 'Y-08-29'],
    ['geb', 'Y-09-01', 'Y-09-27', { page: 212, shelf: 'setAside', shelvedOn: 'Y-10-02' }],
    ['moi', 'Y-09-08', 'Y-12-31', { page: 640, shelf: 'reading' }],
    ['doe', 'Y-10-06', 'Y-12-31', { page: 218, shelf: 'reading' }],
  ],
  want: [['hoc', 'Y-03-29'], ['mt', 'Y-03-29'], ['sg', 'Y1-06-02'], ['lhd', 'Y1-09-11'], ['sc', 'Y-02-14'], ['hyp', 'Y-06-30'], ['sil', 'Y-01-25'], ['nor', 'Y-08-17'], ['mort', 'Y1-02-26']],
  reviews: [
    ['gp', 4, 'A con man made to run a dead post office. Funny all the way through, and the clacks gave me more to think about than I expected.', 'Y-05-31'],
    ['chip', 4, 'A clear history of the chip industry. A bit long in the middle, but it explains why a few factories matter so much.', 'Y-03-30'],
    ['fotr', 5, 'Third time through, and the long walk to Rivendell is still my favourite part.', 'Y-01-14'],
    ['dg', 5, 'The Chain of Dogs is one of the best things I have read. It hurts, and it is meant to.', 'Y-03-28'],
    ['eai', 4, 'Careful reporting on how the big AI labs work. Worth reading next to The Coming Wave.', 'Y-08-29'],
    ['pote', 5, 'Forty years of building one cathedral, and I never wanted it to end.', 'Y1-07-10'],
    ['tcmc', 5, 'The best revenge story there is. Long, but it never drags.', 'Y2-03-20'],
  ],
};

const FRIENDS = [
  {
    name: 'Jonas', handle: 'jonas', portrait: 'emperor', since: 'Y2-03-12', friendSince: 'Y2-06-02',
    bio: 'Long books only. Currently somewhere in the middle of the Malazan Empire.',
    goals: { [Y]: 7000 }, visibility: { reading: 'everyone', progress: 'everyone' },
    books: [['gotm', 'Y-01-03', 'Y-01-25'], ['dg', 'Y-01-27', 'Y-03-02'], ['moi', 'Y-03-05', 'Y-04-20'], ['tcmc', 'Y-04-25', 'Y-06-10'],
      ['pote', 'Y-06-14', 'Y-07-30'], ['geb', 'Y-08-02', 'Y-09-15'], ['hoc', 'Y-09-20', 'Y-12-31', { page: 760, shelf: 'reading' }]],
    reviews: [['moi', 5, 'The siege of Capustan is the best thing in the series so far. Worth every one of the 1,187 pages.', 'Y-04-20'],
      ['dg', 5, 'Brutal and brilliant. Start here if Gardens of the Moon put you off.', 'Y-03-02']],
  },
  {
    name: 'Ingrid', handle: 'ingrid', portrait: 'knight', since: 'Y1-02-20', friendSince: 'Y1-03-04',
    bio: 'Short novels and long walks.',
    goals: { [Y]: 3000 }, visibility: {},
    books: [['f451', 'Y-01-05', 'Y-01-09'], ['woe', 'Y-02-01', 'Y-02-06'], ['mort', 'Y-03-03', 'Y-03-12'], ['gp', 'Y-04-10', 'Y-04-22'],
      ['lhd', 'Y-06-01', 'Y-06-18'], ['hob', 'Y-08-05', 'Y-08-15'], ['sg', 'Y-10-01', 'Y-12-31', { page: 140, shelf: 'reading' }]],
    reviews: [['f451', 4, 'Short and sharp. It reads differently now than it did at school.', 'Y-01-09']],
  },
  {
    name: 'Marius', handle: 'marius', portrait: 'astrologer', since: 'Y1-10-01', friendSince: 'Y1-11-20',
    bio: 'Nonfiction, mostly. Economics, history and whatever the news makes me curious about.',
    goals: { [Y]: 4000 }, visibility: {},
    books: [['bs', 'Y-01-08', 'Y-02-02'], ['tfs', 'Y-02-10', 'Y-03-20'], ['sap', 'Y-04-01', 'Y-04-28'], ['col', 'Y-05-05', 'Y-06-14'],
      ['chip', 'Y-07-01', 'Y-07-25'], ['cw', 'Y-08-10', 'Y-08-30']],
    reviews: [['bs', 3, 'One good idea, said many times.', 'Y-02-02'], ['chip', 4, 'Explains the news better than the news does.', 'Y-07-25']],
  },
  {
    name: 'Sofie', handle: 'sofie', portrait: 'knight', since: 'Y-03-30', friendSince: 'Y-04-08',
    bio: 'New to Discworld and never going back.',
    goals: { [Y]: 2500 }, visibility: {},
    books: [['gp', 'Y-04-02', 'Y-04-16'], ['thud', 'Y-05-01', 'Y-05-20'], ['phm', 'Y-07-07', 'Y-07-30'], ['gg', 'Y-10-12', 'Y-12-31', { page: 210, shelf: 'reading' }]],
    reviews: [['gp', 5, 'Moist von Lipwig is my favourite Pratchett hero.', 'Y-04-16']],
  },
];
// Asked Alex to be friends, not answered yet; and one Alex asked.
const HENRIK = { name: 'Henrik', handle: 'henrik', portrait: 'emperor', since: 'Y-10-28', asksAlexOn: 'Y-11-02', goals: { [Y]: 2000 }, visibility: {}, books: [['hob', 'Y-10-29', 'Y-11-03']], reviews: [] };
const EIRIK = { name: 'Eirik', handle: 'eirik', portrait: 'knight', since: 'Y-09-01', alexAsksOn: 'Y-10-30', goals: { [Y]: 3000 }, visibility: {}, books: [], reviews: [] };

const sql = [];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function make(spec) {
  const reader = new Reader(spec);
  const email = `${spec.handle}@demo.tomekeeper.invalid`;
  await reader.call('POST', '/api/account/register', { displayName: spec.name, email, password: 'lantern harbour winter quill' });
  reader.id = (await reader.call('GET', '/api/account/me')).id;
  await reader.call('PUT', '/api/account/portrait', { portrait: spec.portrait });
  await reader.call('PUT', '/api/profile', { handle: spec.handle, bio: spec.bio ?? '' });
  if (Object.keys(spec.visibility).length) await reader.call('PUT', '/api/profile/visibility', spec.visibility);
  for (const [year, pages] of Object.entries(spec.goals)) {
    if (Number(year) >= Y - 1) await reader.call('PUT', `/api/goals/${year}`, { kind: 'pages', pages, books: null });
    else sql.push(`INSERT INTO reading_goals (user_id, year, pages, books, updated_at) VALUES (${q(reader.id)}, ${year}, ${pages}, NULL, ${q(date(`Y2-01-05`))});`);
  }
  sql.push(`UPDATE users SET created_at = ${q(date(spec.since) + ' 10:00+00')}, email_confirmed = true WHERE id = ${q(reader.id)};`);
  sql.push(`UPDATE reading_goals SET updated_at = ${q(date(spec.since) + ' 10:05+00')} WHERE user_id = ${q(reader.id)};`);

  for (const [id, from, to, opts = {}] of spec.books) {
    const b = book(id);
    const bookId = await reader.bookId(id);
    const start = date(from);
    const end = opts.shelf === 'reading' ? addDays(TODAY, -1) : date(to);
    const last = opts.page ?? b.pages;
    // A log every three days or so, the pages spread evenly.
    const days = Math.max(1, daysBetween(start, end));
    const steps = Math.max(1, Math.min(Math.round(days / 3), Math.ceil(last / 40)));
    await reader.call('PUT', `/api/shelves/${bookId}`, { shelf: 'reading', readOn: realToday });
    for (let i = 1; i <= steps; i++) {
      const page = i === steps ? last : Math.round((last * i) / steps);
      const on = addDays(start, Math.round((days * i) / steps));
      await reader.call('POST', `/api/shelves/${bookId}/progress`, { page, readOn: realToday });
      sql.push(`UPDATE progress_entries SET read_on = ${q(on)}, logged_at = ${q(on + ' 21:00+00')} WHERE user_id = ${q(reader.id)} AND book_id = ${q(bookId)} AND page = ${page};`);
    }
    // The last page finishes the book and puts it on Finished by itself.
    if (opts.shelf && opts.shelf !== 'reading') await reader.call('PUT', `/api/shelves/${bookId}`, { shelf: opts.shelf, readOn: realToday });
    const shelvedOn = opts.shelvedOn ? date(opts.shelvedOn) : opts.shelf === 'reading' ? start : end;
    sql.push(`UPDATE shelf_entries SET shelved_at = ${q(shelvedOn + ' 21:00+00')} WHERE user_id = ${q(reader.id)} AND book_id = ${q(bookId)};`);
  }
  for (const [id, on] of spec.want ?? []) {
    const bookId = await reader.bookId(id);
    await reader.call('PUT', `/api/shelves/${bookId}`, { shelf: 'wantToRead', readOn: realToday });
    sql.push(`UPDATE shelf_entries SET shelved_at = ${q(date(on) + ' 20:00+00')} WHERE user_id = ${q(reader.id)} AND book_id = ${q(bookId)};`);
  }
  for (const [id, rating, text, on] of spec.reviews) {
    const bookId = await reader.bookId(id);
    await reader.call('PUT', `/api/books/${bookId}/review`, { rating, text });
    sql.push(`UPDATE reviews SET written_at = ${q(date(on) + ' 21:30+00')} WHERE user_id = ${q(reader.id)} AND book_id = ${q(bookId)};`);
  }
  return reader;
}

const alex = await make(ALEX);
const friends = [];
for (const spec of FRIENDS) {
  const friend = await make(spec);
  friends.push(friend);
  await alex.call('POST', `/api/fellowship/${spec.handle}/ask`);
  await friend.call('POST', `/api/fellowship/alex/accept`);
  sql.push(`UPDATE friendships SET since = ${q(date(spec.friendSince) + ' 18:00+00')} WHERE (user_id = ${q(alex.id)} AND friend_id = ${q(friend.id)}) OR (user_id = ${q(friend.id)} AND friend_id = ${q(alex.id)});`);
}
// The friends know each other a little too.
await friends[0].call('POST', '/api/fellowship/marius/ask');
await friends[2].call('POST', '/api/fellowship/jonas/accept');
const henrik = await make(HENRIK);
await henrik.call('POST', '/api/fellowship/alex/ask');
sql.push(`UPDATE friend_requests SET sent_at = ${q(date(HENRIK.asksAlexOn) + ' 19:00+00')} WHERE from_id = ${q(henrik.id)};`);
const eirik = await make(EIRIK);
await alex.call('POST', '/api/fellowship/eirik/ask');
sql.push(`UPDATE friend_requests SET sent_at = ${q(date(EIRIK.alexAsksOn) + ' 19:00+00')} WHERE to_id = ${q(eirik.id)};`);

// Readings start and finish with their first and last log; gear is earned again from the moved dates.
const ids = [alex, ...friends, henrik, eirik].map((r) => q(r.id)).join(', ');
sql.push(`UPDATE readings r SET started_on = s.first, finished_on = CASE WHEN r.finished_on IS NULL THEN NULL ELSE s.last END
  FROM (SELECT reading_id, min(read_on) AS first, max(read_on) AS last FROM progress_entries GROUP BY reading_id) s
  WHERE r.id = s.reading_id AND r.user_id IN (${ids});`);
sql.push(`DELETE FROM gear WHERE user_id IN (${ids});`);

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const file = new URL('./out/shift-dates.sql', import.meta.url);
writeFileSync(file, `BEGIN;\n${sql.join('\n')}\nCOMMIT;\n`);
if (PSQL) execSync(`${PSQL} --quiet --set ON_ERROR_STOP=1`, { input: readFileSync(file), stdio: ['pipe', 'inherit', 'inherit'] });
else execFileSync('psql', [DATABASE_URL, '--quiet', '--set', 'ON_ERROR_STOP=1', '--file', file.pathname], { stdio: 'inherit' });

// Quests are worked out when they are asked for, and the gear they earn is recorded then.
for (const reader of [alex, ...friends, henrik, eirik]) for (const year of [Y - 2, Y - 1, Y]) await reader.call('GET', `/api/quests/${year}`);
writeFileSync(new URL('./out/readers.json', import.meta.url), JSON.stringify({ today: TODAY, alex: { email: 'alex@demo.tomekeeper.invalid', handle: 'alex' } }, null, 2));
console.log(`Seeded ${1 + friends.length + 2} readers, ${sql.length} date changes, as of ${TODAY}.`);
