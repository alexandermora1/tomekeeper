// A stand-in for Open Library's search API that serves the demo's catalogue (catalogue.json), so the demo data
// can be made without reaching openlibrary.org. Keys are made up (OL9000…W) and there are no covers, so every
// book gets Tomekeeper's woodcut title page. Run: node demo/open-library.js (port 5099).
const http = require('http');
const catalogue = require('./catalogue.json');

const works = catalogue.map((book, i) => ({
  key: `/works/OL${9000001 + i}W`,
  title: book.title,
  ...(book.subtitle ? { subtitle: book.subtitle } : {}),
  author_name: book.authors,
  first_publish_year: book.year,
  number_of_pages_median: book.pages,
  edition_count: 12,
  // Tomekeeper guesses fiction from the subjects.
  subject: book.fiction ? ['Fiction', 'Literature'] : ['History', 'Nonfiction'],
}));

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/search.json') { res.writeHead(404); return res.end(); }
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const key = /^key:"\/works\/(ol\d+w)"$/.exec(q);
  const docs = works.filter((w) => key
    ? w.key.toLowerCase() === `/works/${key[1]}`
    : w.title.toLowerCase().includes(q) || w.author_name.some((a) => a.toLowerCase().includes(q)));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ numFound: docs.length, num_found: docs.length, start: 0, docs }));
}).listen(5099, () => console.log('Demo Open Library on :5099'));

