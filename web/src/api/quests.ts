import { apiRequest } from './client';

export type GearItem = 'spectacles' | 'cloak' | 'gloves' | 'satchel' | 'lantern' | 'quill';

export interface Quest {
  id: string;
  name: string;
  task: string;
  state: 'done' | 'active' | 'soon';
  percent: number;
  progress: string;
  reward: string;
  slot: string;
  item: GearItem;
}

export interface Gear {
  item: GearItem;
  name: string;
  slot: string;
  quest: string;
  task: string;
  /** The year of the quest that earned it, or null when it isn't earned yet. */
  earnedIn: number | null;
}

export interface Quests {
  year: number;
  quests: Quest[];
  /** All six pieces, in the order of the medallions: the left side from the top, then the right. */
  gear: Gear[];
}

export const quests = {
  get: (year: number) => apiRequest<Quests>('GET', `/api/quests/${year}`),
};
