import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { books } from '../api/books';
import type { ShelfId } from '../api/shelves';
import { Button } from '../components/Button';
import { ErrorSummary } from '../components/forms/ErrorSummary';
import { Fieldset } from '../components/forms/Fieldset';
import { formErrorsFrom, noErrors, type FormErrors } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import formStyles from '../components/forms/forms.module.css';
import { Layout } from '../components/Layout';
import { parseWholeNumber } from '../goals/goalText';
import { usePageTitle } from '../routing/usePageTitle';
import { SHELVES } from '../shelves/shelfText';
import styles from './BookPage.module.css';

const FIELDS = [
  { name: 'title', id: 'title' },
  { name: 'subtitle', id: 'subtitle' },
  { name: 'authors', id: 'authors' },
  { name: 'firstPublishedYear', id: 'first-published-year' },
  { name: 'pageCount', id: 'page-count' },
  { name: 'shelf', id: 'shelf-reading' },
] as const;
type Field = (typeof FIELDS)[number]['name'];

/** Adding a book Open Library doesn't have. It goes straight onto one of the reader's shelves. */
export function AddBookPage() {
  usePageTitle('Add a book by hand');
  const navigate = useNavigate();
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();

    // Numbers are checked here first, since a word in a number field can't be sent as a number.
    const local = noErrors<Field>();
    const year = wholeNumberOrEmpty(text('firstPublishedYear'));
    const pages = wholeNumberOrEmpty(text('pageCount'));
    if (year === undefined) local.fields.firstPublishedYear = 'Enter the year as a number, such as 1971, or leave it empty.';
    if (pages === undefined) local.fields.pageCount = 'Enter the number of pages as a whole number, such as 320, or leave it empty.';
    if (year === undefined || pages === undefined) {
      setErrors(local);
      return;
    }

    setPending(true);
    try {
      const entry = await books.addByHand({
        title: text('title'),
        subtitle: text('subtitle'),
        authors: text('authors').split(',').map((name) => name.trim()).filter(Boolean),
        firstPublishedYear: year,
        pageCount: pages,
        shelf: (form.get('shelf') as ShelfId | null) ?? 'wantToRead',
      });
      navigate(`/books/${entry.book.id}`);
    } catch (error) {
      setErrors(formErrorsFrom(error, FIELDS.map((f) => f.name)));
      setPending(false);
    }
  }

  return (
    <Layout current="library">
      <p className={styles.back}>
        <Link to="/library">Back to the Library</Link>
      </p>
      <h1 className={styles.title}>Add a book by hand</h1>
      <p className={styles.lead}>For books Open Library doesn't have. Only you will see the book you add.</p>

      <form noValidate onSubmit={handleSubmit} className={`${formStyles.form} ${styles.handForm}`}>
        <ErrorSummary errors={errors} fields={FIELDS} />
        <TextField id="title" name="title" label="Title" autoComplete="off" error={errors.fields.title} />
        <TextField id="subtitle" name="subtitle" label="Subtitle (if it has one)" autoComplete="off" error={errors.fields.subtitle} />
        <TextField
          id="authors"
          name="authors"
          label="Author"
          hint="Separate several authors with commas."
          autoComplete="off"
          error={errors.fields.authors}
        />
        <TextField
          id="first-published-year"
          name="firstPublishedYear"
          label="Year first published (if you know it)"
          inputMode="numeric"
          autoComplete="off"
          error={errors.fields.firstPublishedYear}
        />
        <TextField
          id="page-count"
          name="pageCount"
          label="Pages (if you know them)"
          inputMode="numeric"
          autoComplete="off"
          error={errors.fields.pageCount}
        />
        <Fieldset legend="Put it on" error={errors.fields.shelf}>
          {SHELVES.map((shelf) => (
            <label key={shelf.id} className={formStyles.radio}>
              <input type="radio" name="shelf" id={`shelf-${shelf.id}`} value={shelf.id} defaultChecked={shelf.id === 'wantToRead'} />
              {shelf.name}
            </label>
          ))}
        </Fieldset>
        <Button type="submit" aria-disabled={pending || undefined}>
          {pending ? 'Adding…' : 'Add to your shelves'}
        </Button>
      </form>
    </Layout>
  );
}

/** null for an empty field, the number for a whole number, undefined for anything else. */
function wholeNumberOrEmpty(text: string): number | null | undefined {
  if (text === '') return null;
  return parseWholeNumber(text) ?? undefined;
}
