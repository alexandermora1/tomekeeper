import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { account } from '../api/account';
import { ApiError } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { Button, ButtonLink } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { PasswordField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Outcome } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import { PASSWORD_HINT } from './accountText';

const FIELDS = [{ name: 'password', id: 'password' }] as const;
type Field = (typeof FIELDS)[number]['name'];

const BROKEN_LINK = "This reset link doesn't work any more. Ask for a new one.";

/** Opened from the link in the password reset email: /reset-password?email=…&code=… */
export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const { status } = useSession();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const code = params.get('code') ?? '';

  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ kind: 'changed' } | { kind: 'broken'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');

    setPending(true);
    try {
      await account.resetPassword({ email, code, password });
      setResult({ kind: 'changed' });
    } catch (error) {
      // A 400 without field errors means the link itself is wrong or too old; a new password won't help.
      if (error instanceof ApiError && error.status === 400 && Object.keys(error.fieldErrors).length === 0) {
        setResult({ kind: 'broken', message: error.message });
      } else {
        setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
      }
    } finally {
      setPending(false);
    }
  }

  if (!email || !code) return <BrokenLink message={BROKEN_LINK} takeFocus={false} />;
  if (result?.kind === 'broken') return <BrokenLink message={result.message} />;

  return (
    <AuthLayout title="Choose a new password">
      {result?.kind === 'changed' ? (
        <Outcome>
          <p>Your password is changed.</p>
          {status === 'signed-in' ? (
            <ButtonLink to="/">Go to your chronicle</ButtonLink>
          ) : (
            <ButtonLink to="/sign-in">Sign in with the new password</ButtonLink>
          )}
        </Outcome>
      ) : (
        <form noValidate onSubmit={handleSubmit} className={formStyles.form}>
          <p className={formStyles.note}>
            For <strong>{email}</strong>.
          </p>
          {/* Tells password managers which account the new password belongs to. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <ErrorSummary errors={errors} fields={FIELDS} />
          <PasswordField
            id="password"
            name="password"
            label="New password"
            hint={PASSWORD_HINT}
            autoComplete="new-password"
            error={errors.fields.password}
          />
          <Button type="submit" aria-disabled={pending || undefined}>
            {pending ? 'Saving…' : 'Save the new password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function BrokenLink({ message, takeFocus = true }: { message: string; takeFocus?: boolean }) {
  return (
    <AuthLayout title="Choose a new password">
      <Outcome takeFocus={takeFocus}>
        <p>{message}</p>
        <ButtonLink to="/forgot-password">Ask for a new link</ButtonLink>
      </Outcome>
    </AuthLayout>
  );
}
