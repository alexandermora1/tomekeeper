import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { account } from '../api/account';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { PasswordField, TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import styles from './SettingsPage.module.css';

const FIELDS = [
  { name: 'email', id: 'delete-email' },
  { name: 'password', id: 'delete-password' },
] as const;
type Field = (typeof FIELDS)[number]['name'];

/** The reader's account: what it holds, and the way to delete it. More settings come with the profile (stage 5). */
export function SettingsPage() {
  usePageTitle('Settings');
  const { reader } = useSession();
  if (!reader) return null;

  return (
    <Layout current={null}>
      <div className={styles.page}>
        <h1 className={styles.title}>Settings</h1>

        <Frame title="Your account">
          <dl className={styles.details}>
            <dt>Name on the site</dt>
            <dd>{reader.displayName}</dd>
            <dt>Email</dt>
            <dd>
              {reader.email} {reader.emailConfirmed ? '(confirmed)' : '(not confirmed yet)'}
            </dd>
            <dt>Password</dt>
            <dd>
              {reader.hasPassword
                ? 'Set. Change it with “Forgot your password?” on the sign-in page.'
                : 'None: you sign in with Google. To add one, use “Forgot your password?” on the sign-in page.'}
            </dd>
          </dl>
        </Frame>

        <DeleteAccount email={reader.email} hasPassword={reader.hasPassword} />
      </div>
    </Layout>
  );
}

function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const { setReader } = useSession();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);

    setPending(true);
    try {
      await account.deleteAccount({
        email: String(form.get('email') ?? ''),
        password: hasPassword ? String(form.get('password') ?? '') : null,
      });
      setReader(null);
      navigate('/sign-in', { state: { accountDeleted: true } });
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  return (
    <Frame title="Delete your account">
      <p className={styles.text}>
        This deletes your account and everything in it: your goals and portrait, and later your books, reading and
        reviews. It can't be undone. We send a last email to {email} to say it is done.
      </p>
      <form noValidate onSubmit={handleSubmit} className={formStyles.form}>
        <ErrorSummary errors={errors} fields={FIELDS} />
        <TextField
          id="delete-email"
          name="email"
          type="email"
          label="Type your email address to confirm"
          autoComplete="off"
          spellCheck={false}
          error={errors.fields.email}
        />
        {hasPassword && (
          <PasswordField
            id="delete-password"
            name="password"
            label="Your password"
            autoComplete="current-password"
            error={errors.fields.password}
          />
        )}
        <Button type="submit" variant="danger" aria-disabled={pending || undefined} className={styles.button}>
          {pending ? 'Deleting…' : 'Delete my account'}
        </Button>
      </form>
    </Frame>
  );
}
