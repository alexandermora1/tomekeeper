import { useId, type ReactNode } from 'react';
import styles from './forms.module.css';

interface FieldsetProps {
  legend: string;
  hint?: ReactNode;
  /** The error message from the last submit, if any. */
  error?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A group of choices, such as radio buttons, with one question as its legend. Screen readers read the
 * legend with each choice, so "Pages" is heard as "Count your goal in, Pages".
 */
export function Fieldset({ legend, hint, error, className, children }: FieldsetProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className={[styles.fieldset, className].filter(Boolean).join(' ')} aria-describedby={describedBy}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <span className="visually-hidden">Error:</span> {error}
        </p>
      )}
      {children}
    </fieldset>
  );
}
