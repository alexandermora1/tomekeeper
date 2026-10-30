import { useEffect, useId, useRef, type MouseEvent } from 'react';
import type { FormErrors } from './formErrors';
import styles from './forms.module.css';

interface ErrorSummaryProps<Field extends string> {
  /** The errors from the last submit. Pass the object from state: a new object moves the focus here again. */
  errors: FormErrors<Field>;
  /** The form's fields in the order they appear, with the id of each input, so the summary can link to them. */
  fields: readonly { name: Field; id: string }[];
}

/**
 * A list of everything that went wrong, at the top of the form. After a failed submit it takes the focus,
 * so a screen reader reads the problems and a keyboard user can go straight to each field from here.
 */
export function ErrorSummary<Field extends string>({ errors, fields }: ErrorSummaryProps<Field>) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const items = [
    ...errors.general.map((text) => ({ text, targetId: null })),
    ...fields.flatMap(({ name, id }) => {
      const text = errors.fields[name];
      return text ? [{ text, targetId: id }] : [];
    }),
  ];
  const count = items.length;

  // Runs when a submit has produced a new errors object, not on every render.
  useEffect(() => {
    if (errors.general.length > 0 || Object.keys(errors.fields).length > 0) ref.current?.focus();
  }, [errors]);

  if (count === 0) return null;

  return (
    <div ref={ref} tabIndex={-1} role="group" aria-labelledby={headingId} className={styles.summary}>
      <h2 id={headingId} className={styles.summaryTitle}>
        {count === 1 ? 'There is a problem' : `There are ${count} problems`}
      </h2>
      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={item.text + (item.targetId ?? '')}>
            {item.targetId ? (
              <a href={`#${item.targetId}`} onClick={(event) => goToField(event, item.targetId)}>
                {item.text}
              </a>
            ) : (
              item.text
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Focuses the input and scrolls its label into view, so the reader sees what the field is. */
function goToField(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const input = document.getElementById(id);
  if (!input) return;
  event.preventDefault();
  document.querySelector(`label[for="${id}"]`)?.scrollIntoView({ block: 'start' });
  input.focus({ preventScroll: true });
}
