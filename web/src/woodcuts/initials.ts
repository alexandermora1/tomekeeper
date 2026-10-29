/**
 * Hans Holbein's Alphabet of Death (about 1523), with the letters washed in gold.
 * The alphabet has 24 letters: like printers of the time, J uses the I initial and U uses the V initial.
 */

const files = import.meta.glob<string>('../assets/woodcuts/initials/initial-*.webp', {
  eager: true,
  import: 'default',
});

const byLetter: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const match = /initial-([A-Z])\.webp$/.exec(path);
  if (match?.[1]) byLetter[match[1]] = url;
}

/** The letter of the woodcut alphabet that stands in for a character, or null if there is none. */
export function initialLetterFor(character: string): string | null {
  const plain = character.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (!/^[A-Z]$/.test(plain)) return null;
  if (plain === 'J') return 'I';
  if (plain === 'U') return 'V';
  return plain;
}

/** Image URL of the gold initial for a character, or null if there is none. */
export function initialFor(character: string): string | null {
  const letter = initialLetterFor(character);
  return letter ? (byLetter[letter] ?? null) : null;
}

export const initialLetters = Object.keys(byLetter).sort();
