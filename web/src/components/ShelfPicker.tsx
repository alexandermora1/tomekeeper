import { useEffect, useId, useState, type ReactNode } from 'react';
import type { ShelfId } from '../api/shelves';
import { SHELVES } from '../shelves/shelfText';
import { Button } from './Button';
import styles from './ShelfPicker.module.css';

interface ShelfPickerProps {
  /** The book's title. Screen readers hear it in the names ("Shelf for Dune", "Add Dune"), because a list has many pickers. */
  title: string;
  /** The shelf the book is on, or null when it is on none. */
  current: ShelfId | null;
  /** While saving: the button says so and does nothing. */
  busy?: boolean;
  /** A problem to show under the picker. */
  error?: string;
  onChoose: (shelf: ShelfId) => void;
  /** More buttons after the main one, such as "Remove". */
  children?: ReactNode;
  className?: string;
}

/**
 * Choosing a shelf for a book: a list of the four shelves and a button. The button does the work, not the list,
 * so moving through the list with the arrow keys changes nothing until the reader presses it.
 */
export function ShelfPicker({ title, current, busy = false, error, onChoose, children, className }: ShelfPickerProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [choice, setChoice] = useState<ShelfId>(current ?? 'wantToRead');
  // Follow the book when it moves, here or elsewhere on the page.
  useEffect(() => {
    if (current) setChoice(current);
  }, [current]);
  const unchanged = choice === current;

  return (
    <div className={[styles.picker, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          Shelf{' '}
          <span className="visually-hidden">for {title}</span>
        </label>
        <select
          id={id}
          value={choice}
          onChange={(event) => setChoice(event.target.value as ShelfId)}
          className={styles.select}
          aria-describedby={error ? errorId : undefined}
        >
          {SHELVES.map((shelf) => (
            <option key={shelf.id} value={shelf.id}>
              {shelf.name}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-disabled={busy || unchanged || undefined}
          onClick={() => {
            if (!busy && !unchanged) onChoose(choice);
          }}
        >
          {busy ? 'Saving…' : current ? 'Move' : 'Add'}{' '}
          <span className="visually-hidden">{title}</span>
        </Button>
        {children}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          <span className="visually-hidden">Error:</span> {error}
        </p>
      )}
    </div>
  );
}
