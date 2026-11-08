/**
 * Stops the clock at the demo's day, so "today", this month and this year match the recorded data however long
 * the demo stays online. `new Date()` and `Date.now()` give noon on that day; dates made from a value are as usual.
 */
export function freezeClock(isoDate: string): void {
  const RealDate = Date;
  const fixed = new RealDate(`${isoDate}T12:00:00`).getTime();
  function DemoDate(this: unknown, ...args: unknown[]): unknown {
    // Called without `new`, Date gives the time as text.
    if (!new.target) return new RealDate(fixed).toString();
    return Reflect.construct(RealDate, args.length > 0 ? args : [fixed], new.target);
  }
  DemoDate.prototype = RealDate.prototype;
  Object.assign(DemoDate, { now: () => fixed, parse: RealDate.parse, UTC: RealDate.UTC });
  globalThis.Date = DemoDate as unknown as DateConstructor;
}
