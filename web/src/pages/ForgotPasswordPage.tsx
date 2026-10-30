import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { account } from '../api/account';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Outcome } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';

const FIELDS = [{ name: 'email', id: 'email' }] as const;
type Field = (typeof FIELDS)[number]['name'];

export function ForgotPasswordPage() {
  usePageTitle('Reset your password');
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();

    setPending(true);
    try {
      await account.forgotPassword({ email });
      setSentTo(email);
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Reset your password">
      {sentTo ? (
        <Outcome>
          {/* The same answer whether or not the address has an account, so nobody can find out who has one. */}
          <p>
            If there is an account for <strong>{sentTo}</strong>, we've sent it a link to choose a new password.
          </p>
          <p className={formStyles.small}>It can take a few minutes. Look in your spam folder if it doesn't arrive.</p>
          <Link to="/sign-in">Back to sign in</Link>
        </Outcome>
      ) : (
        <form noValidate onSubmit={handleSubmit} className={formStyles.form}>
          <p className={formStyles.note}>
            Enter the email you signed up with, and we'll send you a link to choose a new password.
          </p>
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
          <Button type="submit" aria-disabled={pending || undefined}>
            {pending ? 'Sending…' : 'Send the link'}
          </Button>
          <p className={formStyles.note}>
            <Link to="/sign-in">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
