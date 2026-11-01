const numberFormat = new Intl.NumberFormat('en-GB');

interface BookFacts {
  authors: string[];
  firstPublishedYear: number | null;
  pageCount: number | null;
}

/** "Frank Herbert · 1965 · 604 pages": up to three authors, then the year and the page count when known. */
export function bookDetails({ authors, firstPublishedYear, pageCount }: BookFacts): string {
  return [
    authors.length > 0 ? authors.slice(0, 3).join(', ') : 'Unknown author',
    firstPublishedYear?.toString(),
    pageCount ? `${numberFormat.format(pageCount)} pages` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
