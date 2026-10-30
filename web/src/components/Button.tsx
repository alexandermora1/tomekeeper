import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary: the main action of a form, ink filled. Secondary: smaller, outlined. Danger: red, for actions that can't be undone. */
  variant?: Variant;
}

/** A button. It is type="button" unless you pass type="submit". */
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button type="button" {...props} className={classes(variant, className)} />;
}

/** A link that looks like a button, for "go to the next page" actions. */
export function ButtonLink({ variant = 'primary', className, ...props }: LinkProps & { variant?: Variant }) {
  return <Link {...props} className={classes(variant, className)} />;
}

function classes(variant: Variant, extra: string | undefined) {
  return [styles.button, styles[variant], extra].filter(Boolean).join(' ');
}
