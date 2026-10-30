import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './forms.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'children'> {
  id: string;
  label: string;
  /** Help shown under the label, such as what the field is for. */
  hint?: ReactNode;
  /** The error message from the last submit, if any. */
  error?: string;
  /** Extra controls under the input, such as the show password button. */
  after?: ReactNode;
}

/**
 * A labelled input with an optional hint and error message. The hint and error are linked to the input
 * with aria-describedby, so screen readers read them when the input gets focus.
 */
export function TextField({ id, label, hint, error, after, ...input }: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
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
      <input
        id={id}
        type="text"
        {...input}
        className={error ? `${styles.input} ${styles.invalid}` : styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {after}
    </div>
  );
}

/**
 * A password field with a button to show what has been typed. There are no rules about capital letters
 * or symbols, and pasting from a password manager works.
 */
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'after'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      after={
        <button type="button" className={styles.reveal} aria-controls={props.id} onClick={() => setVisible(!visible)}>
          {visible ? 'Hide password' : 'Show password'}
        </button>
      }
    />
  );
}
