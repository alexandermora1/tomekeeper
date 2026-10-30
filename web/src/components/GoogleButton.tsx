import '@fontsource/google-sans/latin-500.css';
import { useEffect, useState } from 'react';
import { account, googleSignInUrl, type SignInOptions } from '../api/account';
import styles from './GoogleButton.module.css';

/**
 * Google's own "G" logo. Google's rules say the button must use their file, unchanged, so it isn't drawn here:
 * download it as the README explains and save it as src/assets/brand/google-g.png (or .svg). Until then the
 * button shows without it.
 */
const logo = Object.values(
  import.meta.glob<string>('../assets/brand/google-g.{png,svg}', { eager: true, query: '?url', import: 'default' }),
)[0];

interface GoogleChoiceProps {
  /** "Sign in with Google" or "Sign up with Google". */
  mode: 'sign-in' | 'sign-up';
  /** Where to come back to afterwards. */
  returnTo: string;
}

/**
 * The Google button and the "or with your email" line under it, following Google's branding rules for a
 * custom button: Google Sans Medium, Google's colours for light and dark, the G on the left. Nothing shows
 * if the API doesn't have Google sign-in set up.
 */
export function GoogleChoice({ mode, returnTo }: GoogleChoiceProps) {
  const options = useSignInOptions();
  if (!options?.google) return null;

  return (
    <div className={styles.choice}>
      <a href={googleSignInUrl(returnTo)} className={styles.button}>
        {logo && <img src={logo} alt="" width={20} height={20} className={styles.logo} />}
        <span>{mode === 'sign-up' ? 'Sign up with Google' : 'Sign in with Google'}</span>
      </a>
      <p className={styles.or}>or with your email</p>
    </div>
  );
}

/** Asks the API which ways to sign in it offers. Null until it answers; no Google if it can't be reached. */
function useSignInOptions(): SignInOptions | null {
  const [options, setOptions] = useState<SignInOptions | null>(null);
  useEffect(() => {
    let current = true;
    account
      .signInOptions()
      .catch(() => ({ google: false }))
      .then((result) => {
        if (current) setOptions(result);
      });
    return () => {
      current = false;
    };
  }, []);
  return options;
}
