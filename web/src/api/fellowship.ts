import type { PortraitId } from './account';
import { apiRequest } from './client';

/** How the signed-in reader stands with another: "asked" means you asked them, "asksYou" that they asked you. */
export type Relation = 'you' | 'friend' | 'asked' | 'asksYou' | 'none';

/** Another reader, as a line in a list. */
export interface ReaderCard {
  handle: string;
  displayName: string;
  portrait: PortraitId | null;
  relation: Relation;
  /** When you became friends, or when the request was sent; null in search results. */
  since: string | null;
}

export interface FellowshipLists {
  friends: ReaderCard[];
  /** Requests you haven't answered or ignored, newest first. */
  askingYou: ReaderCard[];
  /** Your requests that are still open, newest first. */
  youAsked: ReaderCard[];
}

const path = (handle: string) => `/api/fellowship/${encodeURIComponent(handle)}`;
const relation = async (method: 'POST' | 'DELETE', to: string) => (await apiRequest<{ relation: Relation }>(method, to)).relation;

export const fellowship = {
  lists: () => apiRequest<FellowshipLists>('GET', '/api/fellowship'),
  /** Readers whose name or address contains the words, at least 2 letters. */
  search: async (q: string) => (await apiRequest<{ readers: ReaderCard[] }>('GET', `/api/readers?q=${encodeURIComponent(q)}`)).readers,
  /** Asks to be friends; if they have asked you already, you become friends at once. */
  ask: (handle: string) => relation('POST', `${path(handle)}/ask`),
  accept: (handle: string) => relation('POST', `${path(handle)}/accept`),
  /** Hides their request from you. They aren't told. */
  ignore: (handle: string) => relation('POST', `${path(handle)}/ignore`),
  /** Withdraws your request, or ends the friendship. */
  leave: (handle: string) => relation('DELETE', path(handle)),
};
