import type { PortraitId } from '../api/account';
import astrologer from '../assets/woodcuts/portrait-astrologer.webp';
import emperor from '../assets/woodcuts/portrait-emperor.webp';
import knight from '../assets/woodcuts/portrait-knight.webp';

export interface PortraitInfo {
  id: PortraitId;
  name: string;
  src: string;
  /** Which part of the woodcut to show in the arched frame (CSS object-position). */
  focus: string;
}

/** The portraits a reader can choose: details from Holbein's Dance of Death (1523–25), with Death left out. */
export const PORTRAITS: readonly PortraitInfo[] = [
  { id: 'astrologer', name: 'Astrologer', src: astrologer, focus: '50% 30%' },
  { id: 'knight', name: 'Knight', src: knight, focus: '45% 18%' },
  { id: 'emperor', name: 'Emperor', src: emperor, focus: '50% 0%' },
];

export function portraitInfo(id: PortraitId): PortraitInfo {
  // The list has every id, so this always finds one.
  return PORTRAITS.find((p) => p.id === id) ?? PORTRAITS[0]!;
}
