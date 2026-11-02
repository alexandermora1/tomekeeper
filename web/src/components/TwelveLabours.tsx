import sun from '../assets/woodcuts/sun.webp';
import styles from './TwelveLabours.module.css';

/** The months with the labours of medieval calendars, as in the 2c design. */
const MONTHS = [
  ['January', 'Feasting'],
  ['February', 'By the fire'],
  ['March', 'Pruning'],
  ['April', 'Planting'],
  ['May', 'Riding out'],
  ['June', 'Mowing'],
  ['July', 'Reaping'],
  ['August', 'Threshing'],
  ['September', 'Grape harvest'],
  ['October', 'Sowing'],
  ['November', 'Acorn harvest'],
  ['December', 'Baking bread'],
] as const;

const numberFormat = new Intl.NumberFormat('en-GB');
const C = 340; // the wheel's centre, in a 680 by 680 drawing

interface TwelveLaboursProps {
  year: number;
  /** Pages per month, January first. */
  pagesByMonth: number[];
  pagesRead: number;
  /** The year's goal in pages, if the goal counts pages. */
  goalPages: number | null;
  now?: Date;
}

/**
 * The year as the twelve labours of the months: a wheel on wide screens, square month boxes on phones.
 * The month boxes are the same information as a list; on wide screens they are kept for screen readers
 * (visually hidden), and the wheel, which is only a picture of them, is hidden from screen readers.
 */
export function TwelveLabours({ year, pagesByMonth, pagesRead, goalPages, now = new Date() }: TwelveLaboursProps) {
  const thisYear = now.getFullYear();
  const currentMonth = year === thisYear ? now.getMonth() : -1;
  const isFuture = (month: number) => year > thisYear || (year === thisYear && month > currentMonth);
  // A month is full at a twelfth of the goal; without a goal, at the best month so far.
  const monthTarget = goalPages ? goalPages / 12 : Math.max(...pagesByMonth, 1);
  const fraction = (pages: number) => Math.min(pages / monthTarget, 1);

  return (
    <div className={styles.labours}>
      <Wheel
        pagesByMonth={pagesByMonth}
        pagesRead={pagesRead}
        goalPages={goalPages}
        currentMonth={currentMonth}
        isFuture={isFuture}
        fraction={fraction}
        dayAngle={year === thisYear ? dayAngle(now) : null}
      />
      <ol className={styles.months} aria-label={`Pages read each month in ${year}`}>
        {MONTHS.map(([name, labour], month) => {
          const pages = pagesByMonth[month] ?? 0;
          const future = isFuture(month);
          return (
            <li
              key={name}
              className={[styles.month, month === currentMonth ? styles.current : '', future ? styles.future : ''].join(' ')}
              aria-current={month === currentMonth ? 'date' : undefined}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.labour}>{labour}</span>
              <span className={styles.pages}>{future ? 'To come' : `${numberFormat.format(pages)} ${pages === 1 ? 'page' : 'pages'}`}</span>
              {!future && (
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ width: `${fraction(pages) * 100}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Where today is on the wheel, in degrees from the top. */
function dayAngle(now: Date): number {
  const start = Date.UTC(now.getFullYear(), 0, 1);
  const end = Date.UTC(now.getFullYear() + 1, 0, 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return -90 + ((today - start) / (end - start)) * 360;
}

interface WheelProps {
  pagesByMonth: number[];
  pagesRead: number;
  goalPages: number | null;
  currentMonth: number;
  isFuture: (month: number) => boolean;
  fraction: (pages: number) => number;
  dayAngle: number | null;
}

function Wheel({ pagesByMonth, pagesRead, goalPages, currentMonth, isFuture, fraction, dayAngle }: WheelProps) {
  const ink = { stroke: 'var(--ink)' };
  return (
    <svg className={styles.wheel} viewBox="-60 -20 800 720" aria-hidden="true" focusable="false">
      <circle cx={C} cy={C} r={298} style={{ ...ink, fill: 'var(--page)', strokeWidth: 3 }} />
      <path d={ticks(276, 292, 120)} style={{ ...ink, fill: 'none', strokeWidth: 1.2 }} />
      <circle cx={C} cy={C} r={292} style={{ ...ink, fill: 'none', strokeWidth: 1.2 }} />
      <circle cx={C} cy={C} r={274} style={{ ...ink, fill: 'var(--page)', strokeWidth: 2 }} />

      {MONTHS.map(([name, labour], month) => {
        const start = -90 + 30 * month;
        const pages = pagesByMonth[month] ?? 0;
        const future = isFuture(month);
        const filled = 30 * fraction(pages);
        const [x, y] = point(194, start + 15);
        return (
          <g key={name}>
            <path
              d={sector(140, 244, start, start + 30)}
              style={{ ...ink, fill: month === currentMonth ? 'var(--wash)' : 'var(--raised)', strokeWidth: 1.5 }}
            />
            <path
              d={sector(248, 268, start, start + 30)}
              style={{ ...ink, fill: 'var(--page)', strokeWidth: 1.2, strokeDasharray: future ? '4 3' : undefined }}
            />
            {filled > 1.2 && <path d={sector(250, 266, start + 0.6, start + filled - 0.6)} style={{ fill: 'var(--blue)' }} />}
            <text x={x} y={y - 8} className={styles.wheelName} style={{ fill: month === currentMonth ? 'var(--accent)' : future ? 'var(--muted)' : 'var(--ink)' }}>
              {name}
            </text>
            <text x={x} y={y + 11} className={styles.wheelLabour}>
              {labour}
            </text>
            <text x={x} y={y + 29} className={styles.wheelPages}>
              {future ? 'To come' : `${numberFormat.format(pages)} pages`}
            </text>
          </g>
        );
      })}

      <circle cx={C} cy={C} r={140} style={{ ...ink, fill: 'var(--page)', strokeWidth: 2.5 }} />
      <path d={ticks(128, 138, 90)} style={{ ...ink, fill: 'none', strokeWidth: 1 }} />
      <circle cx={C} cy={C} r={127} style={{ ...ink, fill: 'var(--page)', strokeWidth: 1.5 }} />
      <image href={sun} x={C - 34} y={226} width={68} height={68} />
      <text x={C} y={350} className={styles.hubTotal}>
        {numberFormat.format(pagesRead)}
      </text>
      <text x={C} y={382} className={styles.hubOf}>
        {goalPages ? `of ${numberFormat.format(goalPages)} pages` : 'pages this year'}
      </text>
      {goalPages && (
        <text x={C} y={408} className={styles.hubPercent}>
          {Math.min(100, Math.floor((pagesRead / goalPages) * 100))} percent
        </text>
      )}

      {dayAngle !== null && <Today angle={dayAngle} />}
    </svg>
  );
}

/** A pointer at today's place on the rim, with the word Today outside it. */
function Today({ angle }: { angle: number }) {
  const [tx, ty] = point(300, angle);
  const [ax, ay] = point(318, angle - 2.6);
  const [bx, by] = point(318, angle + 2.6);
  const [lx, ly] = point(326, angle);
  const right = Math.cos((angle * Math.PI) / 180) >= 0;
  return (
    <>
      <path d={`M${tx} ${ty} L${ax} ${ay} L${bx} ${by} Z`} style={{ fill: 'var(--ink)' }} />
      <text x={lx} y={ly + 5} className={styles.today} style={{ textAnchor: right ? 'start' : 'end' }}>
        Today
      </text>
    </>
  );
}

function point(r: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))];
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

/** A ring segment between two radii and two angles. */
function sector(inner: number, outer: number, from: number, to: number): string {
  const large = to - from > 180 ? 1 : 0;
  const [o1x, o1y] = point(outer, from);
  const [o2x, o2y] = point(outer, to);
  const [i2x, i2y] = point(inner, to);
  const [i1x, i1y] = point(inner, from);
  return `M${o1x} ${o1y} A${outer} ${outer} 0 ${large} 1 ${o2x} ${o2y} L${i2x} ${i2y} A${inner} ${inner} 0 ${large} 0 ${i1x} ${i1y} Z`;
}

/** Short lines around a ring, like the marks on a dial. */
function ticks(inner: number, outer: number, count: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const [x1, y1] = point(inner, angle);
    const [x2, y2] = point(outer, angle);
    d += `M${x1} ${y1}L${x2} ${y2}`;
  }
  return d;
}
