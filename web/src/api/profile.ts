import type { PortraitId } from './account';
import type { ReaderCard, Relation } from './fellowship';
import type { Volume } from './legacy';
import { apiRequest } from './client';

export type Visibility = 'everyone' | 'friends' | 'onlyYou';

/** Who can see each part of a profile. */
export interface VisibilitySettings {
  /** Year and volumes: pages, goal, level and past years. */
  progress: Visibility;
  reading: Visibility;
  reviews: Visibility;
  friends: Visibility;
}

export interface ProfileSettings {
  /** The address on the site, as in /readers/alex. */
  handle: string;
  bio: string | null;
  visibility: VisibilitySettings;
}

export type ViewedAs = 'you' | 'friend' | 'stranger';

export interface ReaderProfile {
  handle: string;
  displayName: string;
  portrait: PortraitId | null;
  bio: string | null;
  /** The year the reader began their chronicle. */
  since: number;
  viewedAs: ViewedAs;
  isOwner: boolean;
  /** Null when hidden from this viewer; the same for the other parts. */
  year: { year: number; pagesRead: number; goalPages: number | null; booksFinished: number; level: number; title: string } | null;
  readingNow: { bookId: string | null; title: string; authors: string[]; percent: number | null }[] | null;
  volumes: Volume[] | null;
  somethingHidden: boolean;
  /** For the owner only. */
  visibility: VisibilitySettings | null;
  /** How you stand with the reader; null on your own profile. */
  relation: Exclude<Relation, 'you'> | null;
  /** The reader's friends, when you may see them. */
  fellowship: ReaderCard[] | null;
}

export const profile = {
  settings: () => apiRequest<ProfileSettings>('GET', '/api/profile'),
  update: (handle: string, bio: string) => apiRequest<ProfileSettings>('PUT', '/api/profile', { handle, bio }),
  setVisibility: (changes: Partial<VisibilitySettings>) => apiRequest<ProfileSettings>('PUT', '/api/profile/visibility', changes),
  /** A reader's profile. The owner can ask to see it as a friend or someone else would. */
  reader: (handle: string, as?: ViewedAs) =>
    apiRequest<ReaderProfile>('GET', `/api/readers/${encodeURIComponent(handle)}${as && as !== 'you' ? `?as=${as}` : ''}`),
};
