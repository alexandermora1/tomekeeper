import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { account } from '../api/account';
import { AuthLayout, AuthSwitch } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { PasswordField, TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { GoogleChoice } from '../components/GoogleButton';
import { Notice } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';
import { returnPath } from '../session/guards';
import { useSession } from '../session/sessionContext';
import { GOOGLE_PROBLEMS } from './accountText';

const FIELDS = [
  { name: 'email', id: 'email' },
  { name: 'password', id: 'password' },
] as const;
type Field = (typeof FIELDS)[number]['name'];

export function SignInPage() {
  usePageTitle('Sign in');
  const { setReader } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // When Google sign-in didn't work, the API sends the reader here with ?google=… saying why.
  const [errors, setErrors] = useState<FormErrors<Field>>(() => googleErrors(searchParams.get('google')));
  const [pending, setPending] = useState(false);
  const signedOut = hasFlag(location.state, 'signedOut');
  const deleted = hasFlag(location.state, 'accountDeleted');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);

    setPending(true);
    try {
      await account.signIn({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        rememberMe: form.get('rememberMe') === 'on',
      });
      const reader = await account.me();
      setReader(reader);
      navigate(returnPath(location.state), { replace: true });
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  return (
    <AuthLayout
      intro
      title="Welcome back"
      lead="Sign in with the email you signed up with."
      top={<AuthSwitch current="sign-in" />}
    >
      <GoogleChoice mode="sign-in" returnTo={returnPath(location.state)} />
      <form noValidate onSubmit={handleSubmit} className={formStyles.form}>
        {signedOut && <Notice role="status">You're signed out.</Notice>}
        {deleted && <Notice role="status">Your account is deleted, together with everything in it.</Notice>}
        <ErrorSummary errors={errors} fields={FIELDS} />
        <TextField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="username"
          spellCheck={false}
          error={errors.fields.email}
        />
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          error={errors.fields.password}
        />
        <label className={formStyles.check}>
          <input type="checkbox" name="rememberMe" defaultChecked />
          <span>Keep me signed in on this device</span>
        </label>
        <Button type="submit" aria-disabled={pending || undefined}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className={formStyles.note}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function googleErrors(problem: string | null): FormErrors<Field> {
  const errors = noErrors<Field>();
  if (problem) errors.general.push(GOOGLE_PROBLEMS[problem] ?? GOOGLE_PROBLEMS.failed!);
  return errors;
}

function hasFlag(state: unknown, flag: string): boolean {
  return typeof state === 'object' && state !== null && flag in state && (state as Record<string, unknown>)[flag] === true;
}
