import { initialFor, initialLetterFor, initialLetters } from './initials';

describe('woodcut initials', () => {
  it('has all 24 letters of the alphabet of the time', () => {
    expect(initialLetters).toHaveLength(24);
    expect(initialLetters).not.toContain('J');
    expect(initialLetters).not.toContain('U');
  });

  it('uses I for J and V for U, like printers of the time', () => {
    expect(initialLetterFor('J')).toBe('I');
    expect(initialLetterFor('u')).toBe('V');
    expect(initialFor('J')).toBe(initialFor('I'));
  });

  it('ignores accents and case', () => {
    expect(initialLetterFor('é')).toBe('E');
    expect(initialLetterFor('ö')).toBe('O');
    expect(initialLetterFor('m')).toBe('M');
  });

  it('has no initial for digits, punctuation or letters outside A to Z', () => {
    expect(initialFor('1')).toBeNull();
    expect(initialFor('"')).toBeNull();
    expect(initialFor('Ø')).toBeNull();
  });
});
