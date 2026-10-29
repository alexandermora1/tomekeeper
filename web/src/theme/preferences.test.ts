import { readStored, resolveScript, resolveTheme, writeStored } from './preferences';

describe('resolveTheme', () => {
  it('uses the stored choice when there is one', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('follows the device setting when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('ignores a stored value it does not know', () => {
    expect(resolveTheme('sepia', true)).toBe('dark');
  });
});

describe('resolveScript', () => {
  it('is decorative unless plain is stored', () => {
    expect(resolveScript(null)).toBe('decorative');
    expect(resolveScript('plain')).toBe('plain');
    expect(resolveScript('fancy')).toBe('decorative');
  });
});

describe('storage', () => {
  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStored('x', broken)).toBeNull();
    expect(() => writeStored('x', 'y', broken)).not.toThrow();
  });

  it('reads back what it wrote', () => {
    writeStored('tomekeeper.test', 'yes');
    expect(readStored('tomekeeper.test')).toBe('yes');
  });
});
