import { useId, useState } from 'react';
import { Button } from './Button';
import styles from './ShelfPicker.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');

interface RemoveButtonProps {
  title: string;
  /** Pages logged for the book. When there are any, the button asks first, because they go too. */
  pagesRead: number;
  /** When the reader has reviewed the book, the button asks first too, since the review goes with it. */
  reviewed?: boolean;
  /** "Remove", or "Delete" for a book added by hand. */
  label?: 'Remove' | 'Delete';
  busy?: boolean;
  onRemove: () => void;
}

/**
 * Takes a book off the shelves. If the reader has logged pages for it, the first press asks, and the same button
 * (so the focus stays on it) then says "Yes, remove", with "Keep it" next to it.
 */
export function RemoveButton({ title, pagesRead, reviewed = false, label = 'Remove', busy = false, onRemove }: RemoveButtonProps) {
  const [asking, setAsking] = useState(false);
  const warningId = useId();
  const pages = `${numberFormat.format(pagesRead)} ${pagesRead === 1 ? 'page' : 'pages'}`;
  const lost = [pagesRead > 0 ? `the ${pages} you logged` : null, reviewed ? 'your review' : null].filter(Boolean).join(' and ');

  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={busy || undefined}
        aria-describedby={asking ? warningId : undefined}
        onClick={() => {
          if (busy) return;
          if (asking || lost === '') onRemove();
          else setAsking(true);
        }}
      >
        {asking ? `Yes, ${label.toLowerCase()}` : label}{' '}
        <span className="visually-hidden">{title}</span>
      </Button>
      {asking && (
        <Button variant="secondary" onClick={() => setAsking(false)}>
          Keep it
        </Button>
      )}
      {/* Always in the page, so screen readers hear the warning when it appears. */}
      <span id={warningId} role="status" className={asking ? styles.warning : undefined}>
        {asking ? `This also deletes ${lost}.` : ''}
      </span>
    </>
  );
}
