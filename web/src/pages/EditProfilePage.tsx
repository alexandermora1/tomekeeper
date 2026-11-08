import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { profile as profileApi, type ProfileSettings } from '../api/profile';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { formErrorsFrom, noErrors, problemMessage, type FormErrors } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Layout } from '../components/Layout';
import { siteAddress } from '../routing/siteAddress';
import { usePageTitle } from '../routing/usePageTitle';
import bookStyles from './BookPage.module.css';

const FIELDS = [
  { name: 'handle', id: 'handle' },
  { name: 'bio', id: 'bio' },
] as const;
type Field = (typeof FIELDS)[number]['name'];
const BIO_MAX = 300;

/** Changing the profile's address and the short text about the reader. */
export function EditProfilePage() {
  usePageTitle('Edit profile');
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ProfileSettings | undefined>();
  const [failed, setFailed] = useState<string | undefined>();
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);
  const [bio, setBio] = useState('');

  useEffect(() => {
    let current = true;
    profileApi.settings().then(
      (loaded) => {
        if (!current) return;
        setSettings(loaded);
        setBio(loaded.bio ?? '');
      },
      (problem: unknown) => current && setFailed(problemMessage(problem)),
    );
    return () => {
      current = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await profileApi.update(String(form.get('handle') ?? '').trim(), bio);
      navigate('/profile');
    } catch (problem) {
      setErrors(formErrorsFrom(problem, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  return (
    <Layout current="profile">
      <p className={bookStyles.back}>
        <Link to="/profile">Back to your profile</Link>
      </p>
      <h1 className={bookStyles.title}>Edit profile</h1>
      {failed && <p>{failed}</p>}
      {settings && (
        <form noValidate onSubmit={handleSubmit} className={`${formStyles.form} ${bookStyles.handForm}`}>
          <ErrorSummary errors={errors} fields={FIELDS} />
          <TextField
            id="handle"
            name="handle"
            label="Your address"
            hint={`Your profile is at ${siteAddress('/readers/')} followed by this. Lowercase letters, digits and hyphens.`}
            defaultValue={settings.handle}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.fields.handle}
          />
          <div className={formStyles.field}>
            <label htmlFor="bio" className={formStyles.label}>
              About you
            </label>
            <p id="bio-hint" className={formStyles.hint}>
              A few words, always shown on your profile. {BIO_MAX - bio.length} characters left.
            </p>
            {errors.fields.bio && (
              <p id="bio-error" className={formStyles.error}>
                <span className="visually-hidden">Error:</span> {errors.fields.bio}
              </p>
            )}
            <textarea
              id="bio"
              name="bio"
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className={errors.fields.bio ? `${formStyles.input} ${formStyles.invalid}` : formStyles.input}
              aria-invalid={errors.fields.bio ? true : undefined}
              aria-describedby={errors.fields.bio ? 'bio-hint bio-error' : 'bio-hint'}
            />
          </div>
          <Button type="submit" aria-disabled={pending || undefined}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      )}
    </Layout>
  );
}
