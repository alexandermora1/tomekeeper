import { useState, type ReactNode } from 'react';
import type { Gear, GearItem } from '../api/quests';
import styles from './GearRing.module.css';

/** The gear icons from the 2c design, drawn on a 24 by 24 grid with the current text colour. */
const ICONS: Record<GearItem, ReactNode> = {
  spectacles: (
    <>
      <circle cx="7" cy="14" r="4" />
      <circle cx="17" cy="14" r="4" />
      <path d="M11 14 Q12 12.5 13 14 M3 13 L1.5 9 M21 13 L22.5 9" />
    </>
  ),
  cloak: <path d="M12 3 C9 3 8 5 8 7 L4 21 H20 L16 7 C16 5 15 3 12 3 Z M8 7 C9.5 9 14.5 9 16 7 M12 9 V21" />,
  gloves: (
    <path d="M7 21 V13 L4.5 10 C3.8 9 5.2 7.8 6.2 8.6 L8 10.5 V5 C8 3.8 10.5 3.8 10.5 5 V10 M10.5 4.5 C10.5 3.3 13 3.3 13 4.5 V10 M13 5.5 C13 4.3 15.5 4.3 15.5 5.5 V10.5 M15.5 8 C15.5 6.8 18 6.8 18 8 V15 C18 18.5 16 21 13 21 Z M7 17.5 H18" />
  ),
  satchel: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M3 12.5 H21 M10 12.5 V15.5 H14 V12.5 M8 8 C8 3 16 3 16 8" />
    </>
  ),
  lantern: (
    <>
      <path d="M12 2 V4 M9 4 H15 L16 7 H8 Z" />
      <rect x="7" y="7" width="10" height="12" rx="1" />
      <path d="M6 19 H18 L17 22 H7 Z M12 10 C10.5 12 10.5 14 12 15.5 C13.5 14 13.5 12 12 10 Z" />
    </>
  ),
  quill: <path d="M20 3 C12 4 7 9 5.5 16 L4 21 M20 3 C19 10 14 15 6.5 16 M20 3 L9 14 M10 9 L13 9.5 M8 12 L11 12.5" />,
};

interface GearRingProps {
  gear: Gear[];
  /** The portrait, in the middle. */
  children: ReactNode;
}

/**
 * The reader's portrait with six gear medallions around it, three on each side. Earned pieces are gold.
 * Each medallion is a button: pressing it tells where the piece comes from, in the box below.
 */
export function GearRing({ gear, children }: GearRingProps) {
  const [selected, setSelected] = useState<GearItem>(gear.find((g) => g.earnedIn === null)?.item ?? gear[0]!.item);
  const chosen = gear.find((g) => g.item === selected) ?? gear[0]!;
  const side = (pieces: Gear[], label: string) => (
    <ul className={styles.side} aria-label={label}>
      {pieces.map((piece) => (
        <li key={piece.item}>
          <button
            type="button"
            className={styles.slot}
            aria-pressed={piece.item === selected}
            aria-label={`${piece.slot}: ${piece.name}, ${piece.earnedIn === null ? 'not yet earned' : 'earned'}`}
            onClick={() => setSelected(piece.item)}
          >
            <Medallion item={piece.item} earned={piece.earnedIn !== null} />
            <span aria-hidden="true" className={styles.slotName}>
              {piece.slot}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className={styles.ring}>
        {side(gear.slice(0, 3), 'Gear, left side')}
        <div className={styles.portrait}>{children}</div>
        {side(gear.slice(3), 'Gear, right side')}
      </div>
      <div role="region" aria-live="polite" aria-label="Chosen gear" className={styles.detail}>
        <p className={styles.detailSlot}>{chosen.slot}</p>
        <p className={styles.detailName}>{chosen.name}</p>
        <p className={chosen.earnedIn === null ? styles.detailText : `${styles.detailText} ${styles.earned}`}>
          {chosen.earnedIn === null
            ? `Not yet earned. From the quest ${chosen.quest}: ${chosen.task.charAt(0).toLowerCase()}${chosen.task.slice(1)}`
            : `Earned in ${chosen.earnedIn} from the quest ${chosen.quest}.`}
        </p>
      </div>
    </div>
  );
}

/** A four-lobed woodcut frame with the piece inside: gold when earned, dashed when not. */
function Medallion({ item, earned }: { item: GearItem; earned: boolean }) {
  return (
    <span aria-hidden="true" className={earned ? `paper ${styles.medallion}` : styles.medallion}>
      <svg width="64" height="64" viewBox="0 0 64 64" className={styles.frame}>
        <path
          d="M19 19 A13 13 0 1 1 45 19 A13 13 0 1 1 45 45 A13 13 0 1 1 19 45 A13 13 0 1 1 19 19 Z"
          style={{ fill: earned ? 'var(--gold)' : 'var(--page)', stroke: 'var(--ink)', strokeWidth: 2 }}
        />
        <path
          d="M22.3 22.3 A10 10 0 1 1 41.7 22.3 A10 10 0 1 1 41.7 41.7 A10 10 0 1 1 22.3 41.7 A10 10 0 1 1 22.3 22.3 Z"
          style={{
            fill: earned ? 'var(--gold-pale)' : 'var(--page)',
            stroke: 'var(--ink)',
            strokeWidth: 1,
            strokeDasharray: earned ? undefined : '3 2.5',
          }}
        />
        {[19, 45].flatMap((x) => [19, 45].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" style={{ fill: 'var(--ink)' }} />))}
      </svg>
      <svg width="27" height="27" viewBox="0 0 24 24" className={styles.icon}>
        {ICONS[item]}
      </svg>
    </span>
  );
}
