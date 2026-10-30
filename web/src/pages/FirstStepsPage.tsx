import { useState, type FormEvent } from 'react';
import { account, type PortraitId } from '../api/account';
import { goals, type Goal, type GoalKind } from '../api/goals';
import { AuthLayout } from '../components/AuthLayout';
import { Button, ButtonLink } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { Fieldset } from '../components/forms/Fieldset';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Outcome } from '../components/Notice';
import { Portrait } from '../components/Portrait';
import { PORTRAITS } from '../components/portraits';
import { describeGoal, PAGES_PER_DAY, parseWholeNumber, suggestedGoal } from '../goals/goalText';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';
import styles from './FirstStepsPage.module.css';

const FIELDS = [
  { name: 'kind', id: 'goal-kind-pages' },
  { name: 'pages', id: 'goal-pages' },
  { name: 'books', id: 'goal-books' },
  { name: 'portrait', id: 'portrait-astrologer' },
] as const;
type Field = (typeof FIELDS)[number]['name'];

const KINDS: readonly { id: GoalKind; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'books', label: 'Books' },
  { id: 'both', label: 'Both' },
];

/**
 * Right after signing up: the reader chooses what their goal counts, how much, and a portrait.
 * RequireReader sends new readers here until they have done it. Readers can also come back to change both.
 */
export function FirstStepsPage() {
  usePageTitle('First steps');
  const { reader, setReader } = useSession();
  const [today] = useState(() => new Date());
  const year = today.getFullYear();
  const [suggestion] = useState(() => suggestedGoal(today));

  // Controlled, because the pages and books fields come and go with the kind, and should keep what was typed.
  const [kind, setKind] = useState<GoalKind>('pages');
  const [pages, setPages] = useState(String(suggestion.pages));
  const [books, setBooks] = useState(String(suggestion.books));
  const [portrait, setPortrait] = useState<PortraitId>(reader?.portrait ?? 'astrologer');

  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<Goal | null>(null);

  const countsPages = kind !== 'books';
  const countsBooks = kind !== 'pages';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    // The one check made here: the API only receives numbers, so it can't see what was typed.
    const pageCount = countsPages ? parseWholeNumber(pages) : null;
    const bookCount = countsBooks ? parseWholeNumber(books) : null;
    const typed = noErrors<Field>();
    if (countsPages && pages.trim() && pageCount === null) typed.fields.pages = 'Enter the number of pages in digits, like 1500.';
    if (countsBooks && books.trim() && bookCount === null) typed.fields.books = 'Enter the number of books in digits, like 12.';
    if (typed.fields.pages || typed.fields.books) {
      setErrors(typed);
      return;
    }

    setPending(true);
    try {
      // The goal first: it is the part most likely to need a correction. The portrait marks the steps as done.
      const goal = await goals.put(year, { kind, pages: pageCount, books: bookCount });
      const updated = await account.setPortrait(portrait);
      setSaved(goal);
      setReader(updated);
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
    } finally {
      setPending(false);
    }
  }

  if (saved) {
    return (
      <AuthLayout title="Your chronicle is ready">
        <Outcome>
          <p>
            Your goal is {describeGoal(saved)} by 31 December {saved.year}.
          </p>
          <ButtonLink to="/">Go to your chronicle</ButtonLink>
        </Outcome>
      </AuthLayout>
    );
  }

  const lead = reader && (
    <>
      Welcome, {reader.displayName}.
      {!reader.emailConfirmed && <> We sent a link to {reader.email} to confirm the address.</>}
    </>
  );

  return (
    <AuthLayout title="Two choices, then you're in" lead={lead}>
      <form noValidate onSubmit={handleSubmit} className={styles.form}>
        <ErrorSummary errors={errors} fields={FIELDS} />

        <Fieldset legend="Count your goal in" error={errors.fields.kind}>
          <div className={styles.kinds}>
            {KINDS.map((option) => (
              <label key={option.id} className={formStyles.radio}>
                <input
                  type="radio"
                  name="kind"
                  id={`goal-kind-${option.id}`}
                  value={option.id}
                  checked={kind === option.id}
                  onChange={() => setKind(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Fieldset>

        <div className={styles.numbers}>
          {countsPages && (
            <TextField
              id="goal-pages"
              name="pages"
              label="Pages by 31 December"
              inputMode="numeric"
              autoComplete="off"
              value={pages}
              onChange={(event) => setPages(event.target.value)}
              error={errors.fields.pages}
            />
          )}
          {countsBooks && (
            <TextField
              id="goal-books"
              name="books"
              label="Books by 31 December"
              inputMode="numeric"
              autoComplete="off"
              value={books}
              onChange={(event) => setBooks(event.target.value)}
              error={errors.fields.books}
            />
          )}
        </div>
        <p className={styles.note}>
          Your first goal runs to 31 December {year}. The numbers we filled in are about {PAGES_PER_DAY} pages a day.
          You can change the goal at any time.
        </p>

        <Fieldset legend="Choose your portrait" error={errors.fields.portrait}>
          <div className={styles.portraits}>
            {PORTRAITS.map((option) => (
              <label key={option.id} className={styles.portrait}>
                <Portrait id={option.id} />
                <span className={styles.portraitName}>
                  <input
                    type="radio"
                    name="portrait"
                    id={`portrait-${option.id}`}
                    value={option.id}
                    checked={portrait === option.id}
                    onChange={() => setPortrait(option.id)}
                  />
                  {option.name}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>

        <Button type="submit" aria-disabled={pending || undefined}>
          {pending ? 'Saving…' : 'Begin your chronicle'}
        </Button>
      </form>
    </AuthLayout>
  );
}
