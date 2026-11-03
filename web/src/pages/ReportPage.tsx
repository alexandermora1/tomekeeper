import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { books } from '../api/books';
import { profile } from '../api/profile';
import { REPORT_REASONS, reports, type ReportReason } from '../api/reports';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { Fieldset } from '../components/forms/Fieldset';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import formStyles from '../components/forms/forms.module.css';
import { Layout } from '../components/Layout';
import { Outcome } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';
import bookStyles from './BookPage.module.css';

const FIELDS = [
  { name: 'reason', id: 'reason-spam' },
  { name: 'details', id: 'report-details' },
] as const;
type Field = (typeof FIELDS)[number]['name'];
const numberFormat = new Intl.NumberFormat('en-GB');
const DETAILS_MAX = 1000;

/**
 * Reporting a reader, or their review of a book, to the moderator. Address: /report/{handle}, with ?book={id}
 * for a review. The name comes from the profile; if the two have blocked each other, the address stands in.
 */
export function ReportPage() {
  const { handle = '' } = useParams();
  const [search] = useSearchParams();
  const bookId = search.get('book');
  const [name, setName] = useState(handle);
  const [title, setTitle] = useState<string | undefined>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  usePageTitle(sent ? 'Report sent' : bookId ? 'Report a review' : `Report ${name}`);

  useEffect(() => {
    let current = true;
    profile.reader(handle).then(
      (found) => current && setName(found.displayName),
      () => undefined,
    );
    if (bookId) {
      books.get(bookId).then(
        (book) => current && book && setTitle(book.title),
        () => undefined,
      );
    }
    return () => {
      current = false;
    };
  }, [handle, bookId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const local = noErrors<Field>();
    if (reason === null) local.fields.reason = 'Choose what is wrong.';
    else if (reason === 'other' && details.trim() === '') local.fields.details = 'Say what is wrong, so the moderator knows what to look for.';
    if (Object.keys(local.fields).length > 0) {
      setErrors(local);
      return;
    }
    setPending(true);
    try {
      await reports.send(handle, bookId, reason, details);
      setSent(true);
    } catch (problem) {
      setErrors(formErrorsFrom(problem, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  const back = bookId ? (
    <Link to={`/books/${bookId}`}>Back to {title ?? 'the book'}</Link>
  ) : (
    <Link to={`/readers/${handle}`}>Back to {name}’s profile</Link>
  );

  return (
    <Layout current={null}>
      <p className={bookStyles.back}>{back}</p>
      <h1 className={bookStyles.title}>{bookId ? 'Report a review' : `Report ${name}`}</h1>
      {bookId && (
        <p className={bookStyles.lead}>
          {name}’s review{title ? ` of ${title}` : ''}.
        </p>
      )}
      {sent ? (
        <Outcome>
          <p>
            <strong>Thank you. The report is sent.</strong> The moderator gets a copy of what you reported, as it is now.
          </p>
          <p>If you don’t want to see {name} at all, you can block them on their profile.</p>
        </Outcome>
      ) : (
        <>
          <p className={bookStyles.lead}>Reports go to Tomekeeper’s moderator. {name} isn’t told.</p>
          <form noValidate onSubmit={handleSubmit} className={`${formStyles.form} ${bookStyles.handForm}`}>
            <ErrorSummary errors={errors} fields={FIELDS} />
            <Fieldset legend="What is wrong?" error={errors.fields.reason}>
              {REPORT_REASONS.map((choice) => (
                <label key={choice.id} className={formStyles.radio}>
                  <input
                    type="radio"
                    name="reason"
                    id={`reason-${choice.id}`}
                    value={choice.id}
                    checked={reason === choice.id}
                    onChange={() => setReason(choice.id)}
                  />
                  {choice.label}
                </label>
              ))}
            </Fieldset>
            <div className={formStyles.field}>
              <label htmlFor="report-details" className={formStyles.label}>
                Tell the moderator more
              </label>
              <p id="report-details-hint" className={formStyles.hint}>
                Needed if you choose Something else. {numberFormat.format(DETAILS_MAX - details.length)} characters left.
              </p>
              {errors.fields.details && (
                <p id="report-details-error" className={formStyles.error}>
                  <span className="visually-hidden">Error:</span> {errors.fields.details}
                </p>
              )}
              <textarea
                id="report-details"
                name="details"
                rows={5}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                className={errors.fields.details ? `${formStyles.input} ${formStyles.invalid}` : formStyles.input}
                aria-invalid={errors.fields.details ? true : undefined}
                aria-describedby={errors.fields.details ? 'report-details-hint report-details-error' : 'report-details-hint'}
              />
            </div>
            <Button type="submit" aria-disabled={pending || undefined}>
              {pending ? 'Sending…' : 'Send report'}
            </Button>
          </form>
        </>
      )}
    </Layout>
  );
}
