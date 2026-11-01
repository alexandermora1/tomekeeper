import type { ShelfId } from '../api/shelves';

export interface ShelfInfo {
  id: ShelfId;
  name: string;
  /** Shown on an empty shelf. */
  empty: string;
}

/** The shelves in the order they are shown. */
export const SHELVES: readonly ShelfInfo[] = [
  { id: 'reading', name: 'Reading now', empty: 'Books you are reading go here.' },
  { id: 'wantToRead', name: 'Want to read', empty: 'Books you mean to read go here.' },
  { id: 'finished', name: 'Finished', empty: 'Books you have read go here.' },
  { id: 'setAside', name: 'Set aside', empty: 'Books you have put down for now go here.' },
];

export function shelfName(id: ShelfId): string {
  return SHELVES.find((shelf) => shelf.id === id)?.name ?? id;
}

/** "Dune is on your Want to read shelf." */
export function onShelfMessage(title: string, shelf: ShelfId): string {
  return `${title} is on your ${shelfName(shelf)} shelf.`;
}
