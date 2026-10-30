import { describeGoal, parseWholeNumber, suggestedGoal } from './goalText';

describe('describeGoal', () => {
  it.each([
    [{ pages: 1500, books: null }, '1,500 pages'],
    [{ pages: null, books: 1 }, '1 book'],
    [{ pages: 1, books: 12 }, '1 page and 12 books'],
    [{ pages: 100000, books: 4 }, '100,000 pages and 4 books'],
  ])('describes %o as "%s"', (goal, text) => {
    expect(describeGoal(goal)).toBe(text);
  });
});

describe('parseWholeNumber', () => {
  it.each([
    ['1500', 1500],
    [' 42 ', 42],
    ['1 500', 1500],
    ['1,500', 1500],
    ['1.500', 1500],
    ['12 000 000', 12000000],
  ])('reads "%s" as %i', (text, value) => {
    expect(parseWholeNumber(text)).toBe(value);
  });

  it.each(['', '   ', 'lots', '1.5', '-5', '12 34', '1,50', '1e3'])('refuses "%s"', (text) => {
    expect(parseWholeNumber(text)).toBeNull();
  });
});

describe('suggestedGoal', () => {
  it('suggests about 20 pages a day for the rest of the year', () => {
    // 30 October to 31 December is 63 days: 1,260 pages, rounded to 1,300, which is about 4 books.
    expect(suggestedGoal(new Date(2026, 9, 30))).toEqual({ pages: 1300, books: 4 });
  });

  it('suggests a whole year on 1 January', () => {
    expect(suggestedGoal(new Date(2026, 0, 1))).toEqual({ pages: 7300, books: 24 });
  });

  it('never suggests less than 100 pages and one book', () => {
    expect(suggestedGoal(new Date(2026, 11, 31))).toEqual({ pages: 100, books: 1 });
  });
});
