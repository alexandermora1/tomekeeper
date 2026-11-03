import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Book } from '../api/books';
import { reviews as reviewsApi, type BookReviews as Reviews, type Review } from '../api/reviews';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { Fieldset } from '../components/forms/Fieldset';
import { formErrorsFrom, noErrors, problemMessage, type FormErrors } from '../components/forms/formErrors';
import formStyles from '../components/forms/forms.module.css';
import { Frame } from '../components/Frame';
import { Portrait } from '../components/Portrait';
import { Stars } from '../components/Stars';
import bookStyles from './BookPage.module.css';
import styles from './BookReviews.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const FIELDS = [
  { name: 'rating', id: 'rating-1' },
  { name: 'text', id: 'review-text' },
] as const;
type Field = (typeof FIELDS)[number]['name'];
const TEXT_MAX = 5000;
const HEADING_ID = 'your-review';

interface BookReviewsProps {
  book: Book;
  /** Only books on the reader's shelves can be reviewed. */
  shelved: boolean;
  onReviewed: (reviewed: boolean) => void;
}

/** The reader's own review of the book, and the reviews of others they may see. */
export function BookReviews({ book, shelved, onReviewed }: BookReviewsProps) {
  const [loaded, setLoaded] = useState<Reviews | undefined>();
  const [failed, setFailed] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    reviewsApi.forBook(book.id).then(
      (found) => current && setLoaded(found),
      (problem: unknown) => current && setFailed(problemMessage(problem)),
    );
    return () => {
      current = false;
    };
  }, [book.id]);

  const focusHeading = () => requestAnimationFrame(() => document.getElementById(HEADING_ID)?.focus());

  function saved(review: Review | null, text: string) {
    setLoaded((now) => now && { ...now, mine: review });
    setEditing(false);
    setMessage(text);
    onReviewed(review !== null);
    focusHeading();
  }

  const mine = loaded?.mine ?? null;
  return (
    <Frame title="Reviews" className={bookStyles.frame}>
      {failed && <p>{failed}</p>}
      <h3 id={HEADING_ID} tabIndex={-1} className={styles.subheading}>
        Your review
      </h3>
      <p role="status" className={bookStyles.status}>
        {message}
      </p>
      {!shelved && !mine && <p className={styles.quiet}>Put the book on one of your shelves to review it.</p>}
      {loaded && shelved && (!mine || editing) && (
        <ReviewForm
          book={book}
          mine={mine}
          onSaved={(review) => saved(review, 'Review saved.')}
          onCancel={() => {
            setEditing(false);
            focusHeading();
          }}
        />
      )}
      {mine && !editing && (
        <MyReview
          book={book}
          review={mine}
          onEdit={() => {
            setMessage('');
            setEditing(true);
            focusHeading();
          }}
          onDeleted={() => saved(null, 'Review deleted.')}
        />
      )}

      <h3 className={styles.subheading}>Other readers</h3>
      {loaded &&
        (loaded.others.length === 0 ? (
          <p className={styles.quiet}>No reviews you can see yet. Readers share their reviews with friends or with everyone.</p>
        ) : (
          <ul className={styles.list}>
            {loaded.others.map((review) => (
              <li key={review.reader.handle} className={styles.review}>
                <Portrait id={review.reader.portrait} size="tiny" />
                <div className={styles.body}>
                  <p className={styles.by}>
                    <Link to={`/readers/${review.reader.handle}`}>{review.reader.displayName}</Link>
                    {review.reader.relation === 'friend' && <span className={styles.quiet}> · friend</span>}
                  </p>
                  <ReviewText review={review} />
                  <p className={styles.report}>
                    <Link to={`/report/${review.reader.handle}?book=${book.id}`}>
                      Report <span className="visually-hidden">review by {review.reader.displayName}</span>
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </Frame>
  );
}

/** Stars, the date and the words. */
function ReviewText({ review }: { review: Pick<Review, 'rating' | 'text' | 'writtenAt' | 'editedAt'> }) {
  return (
    <>
      <p className={styles.meta}>
        <Stars rating={review.rating} />{' '}
        <span className={styles.quiet}>
          {dateFormat.format(new Date(review.writtenAt))}
          {review.editedAt && ', edited'}
        </span>
      </p>
      {review.text && <p className={styles.text}>{review.text}</p>}
    </>
  );
}

function MyReview({ book, review, onEdit, onDeleted }: { book: Book; review: Review; onEdit: () => void; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await reviewsApi.remove(book.id);
      onDeleted();
    } catch (problem) {
      setError(problemMessage(problem));
      setBusy(false);
    }
  }

  return (
    <div className={styles.mine}>
      <ReviewText review={review} />
      <p className={styles.quiet}>
        Who sees it follows your <Link to="/profile">profile settings</Link>.
      </p>
      <div className={styles.buttons}>
        {asking ? (
          <>
            <Button variant="danger" aria-disabled={busy || undefined} aria-describedby="delete-review-warning" onClick={() => void remove()}>
              Yes, delete <span className="visually-hidden">your review</span>
            </Button>
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onEdit}>
              Edit review
            </Button>
            <Button variant="secondary" onClick={() => setAsking(true)}>
              Delete review
            </Button>
          </>
        )}
      </div>
      <p id="delete-review-warning" role="status" className={styles.warning}>
        {asking ? 'Delete your review? The words can’t be brought back.' : ''}
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

interface ReviewFormProps {
  book: Book;
  mine: Review | null;
  onSaved: (review: Review) => void;
  onCancel: () => void;
}

function ReviewForm({ book, mine, onSaved, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null);
  const [text, setText] = useState(mine?.text ?? '');
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (rating === null) {
      const local = noErrors<Field>();
      local.fields.rating = 'Choose from 1 to 5 stars.';
      setErrors(local);
      return;
    }
    setPending(true);
    try {
      onSaved(await reviewsApi.save(book.id, rating, text));
    } catch (problem) {
      setErrors(
        formErrorsFrom(
          problem,
          FIELDS.map((f) => f.name),
        ),
      );
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={`${formStyles.form} ${styles.form}`}>
      <ErrorSummary errors={errors} fields={FIELDS} />
      <Fieldset legend="Your rating" error={errors.fields.rating}>
        <div className={styles.stars}>
          <span className={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={styles.star}>
                <input
                  type="radio"
                  id={`rating-${n}`}
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="visually-hidden"
                />
                <span aria-hidden="true" className={rating !== null && n <= rating ? styles.on : styles.off}>
                  {rating !== null && n <= rating ? '★' : '☆'}
                </span>
                <span className="visually-hidden">
                  {n} {n === 1 ? 'star' : 'stars'}
                </span>
              </label>
            ))}
          </span>
          <span className={styles.chosen} aria-hidden="true">
            {rating === null ? 'Not chosen' : `${rating} of 5`}
          </span>
        </div>
      </Fieldset>
      <div className={formStyles.field}>
        <label htmlFor="review-text" className={formStyles.label}>
          Your review (if you like)
        </label>
        <p id="review-text-hint" className={formStyles.hint}>
          Stars alone are fine, but only reviews with words count for The Chronicler. {numberFormat.format(TEXT_MAX - text.length)} characters left.
        </p>
        {errors.fields.text && (
          <p id="review-text-error" className={formStyles.error}>
            <span className="visually-hidden">Error:</span> {errors.fields.text}
          </p>
        )}
        <textarea
          id="review-text"
          name="text"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={errors.fields.text ? `${formStyles.input} ${formStyles.invalid}` : formStyles.input}
          aria-invalid={errors.fields.text ? true : undefined}
          aria-describedby={errors.fields.text ? 'review-text-hint review-text-error' : 'review-text-hint'}
        />
      </div>
      <div className={styles.buttons}>
        <Button type="submit" aria-disabled={pending || undefined}>
          {pending ? 'Saving…' : 'Save review'}
        </Button>
        {mine && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
