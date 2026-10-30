import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import styles from './Notice.module.css';

/** A boxed note with a pointing hand, for things the reader should know before they go on. */
export function Notice({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={[styles.notice, className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className={styles.hand}>
        ☞
      </span>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/**
 * The result of an action that replaces the form, such as "Your email is confirmed".
 * It takes the keyboard focus when it appears, because the button the reader pressed is gone.
 * Pass `takeFocus={false}` when it is there from the start, so it doesn't steal focus as the page opens.
 */
export function Outcome({ children, takeFocus = true }: { children: ReactNode; takeFocus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (takeFocus) ref.current?.focus();
  }, [takeFocus]);
  return (
    <div ref={ref} tabIndex={-1} className={styles.outcome}>
      {children}
    </div>
  );
}
