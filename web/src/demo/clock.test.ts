import { freezeClock } from './clock';

describe('the demo’s clock', () => {
  const RealDate = Date;
  afterEach(() => {
    globalThis.Date = RealDate;
  });

  it('stands still at noon on the demo’s day', () => {
    freezeClock('2026-11-08');

    const now = new Date();
    expect([now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()]).toEqual([2026, 10, 8, 12]);
    expect(Date.now()).toBe(now.getTime());
    expect(now).toBeInstanceOf(RealDate);
  });

  it('leaves dates made from a value as they are', () => {
    freezeClock('2026-11-08');

    expect(new Date(2020, 0, 31).getDate()).toBe(31);
    expect(new Date('2024-02-29T00:00:00Z').toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(Date.UTC(2020, 0, 1)).toBe(RealDate.UTC(2020, 0, 1));
    expect(typeof Date()).toBe('string');
  });
});
