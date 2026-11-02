const NUMERALS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** A year in Roman numerals, as volumes are numbered: 2026 is MMXXVI. */
export function toRoman(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, letters] of NUMERALS) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}
