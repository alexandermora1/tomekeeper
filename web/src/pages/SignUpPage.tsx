import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
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
import { PASSWORD_HINT } from './accountText';

const FIELDS = [
  { name: 'displayName', id: 'display-name' },
  { name: 'email', id: 'email' },
  { name: 'password', id: 'password' },
] as const;
type Field = (typeof FIELDS)[number]['name'];

export function SignUpPage() {
  usePageTitle('Create an account');
  const { setReader } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);

    setPending(true);
    try {
      // The API checks every field at once, including whether the password is common or has been in a breach.
      const reader = await account.register({
        displayName: String(form.get('displayName') ?? ''),
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      setReader(reader);
      navigate(returnPath(location.state), { replace: true });
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  return (
    <AuthLayout intro title="Begin a chronicle" lead="It takes a minute." top={<AuthSwitch current="sign-up" />}>
      <GoogleChoice mode="sign-up" returnTo={returnPath(location.state)} />
      <form noValidate onSubmit={handleSubmit} className={formStyles.form}>
        <ErrorSummary errors={errors} fields={FIELDS} />
        <TextField
          id="display-name"
          name="displayName"
          label="Your name on the site"
          hint="Shown on your profile. You can change it later."
          autoComplete="nickname"
          error={errors.fields.displayName}
        />
        <TextField
          id="email"
          name="email"
          type="email"
          label="Email"
          hint="Only used to sign in and to reset your password."
          autoComplete="username"
          spellCheck={false}
          error={errors.fields.email}
        />
        <PasswordField
          id="password"
          name="password"
          label="Password"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          error={errors.fields.password}
        />
        <Notice>
          At first only your name, portrait and the short text about you are public. Your reading is shown to friends
          only, until you change it on your profile.
        </Notice>
        <Button type="submit" aria-disabled={pending || undefined}>
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>
        <p className={formStyles.small}>
          Read <Link to="/privacy">how Tomekeeper handles your data</Link> before you sign up.
        </p>
      </form>
    </AuthLayout>
  );
}
