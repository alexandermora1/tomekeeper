import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import { fellowship, type FellowshipLists, type ReaderCard, type Relation } from '../api/fellowship';
import { profile } from '../api/profile';
import { Button } from '../components/Button';
import { formErrorsFrom, problemMessage } from '../components/forms/formErrors';
import { TextField } from '../components/forms/TextField';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Portrait } from '../components/Portrait';
import { RelationActions } from '../fellowship/RelationActions';
import { siteAddress } from '../routing/siteAddress';
import { usePageTitle } from '../routing/usePageTitle';
import chronicleStyles from './ChroniclePage.module.css';
import styles from './FellowshipPage.module.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const MESSAGE_ID = 'fellowship-message';

interface Found {
  query: string;
  readers: ReaderCard[];
}

/** Friends, requests to answer, and finding other readers. Address: /fellowship. */
export function FellowshipPage() {
  usePageTitle('Fellowship');
  const [lists, setLists] = useState<FellowshipLists | undefined>();
  const [handle, setHandle] = useState<string | undefined>();
  const [failed, setFailed] = useState<string | undefined>();
  const [message, setMessage] = useState('');

  // The lists and the message change in one go, and are on the page before the focus moves (see RelationActions).
  const load = useCallback(async (text?: string) => {
    try {
      const loaded = await fellowship.lists();
      flushSync(() => {
        setLists(loaded);
        if (text !== undefined) setMessage(text);
      });
    } catch (problem) {
      setFailed(problemMessage(problem));
    }
  }, []);

  useEffect(() => {
    void load();
    profile.settings().then(
      (settings) => setHandle(settings.handle),
      () => undefined,
    );
  }, [load]);

  const changed = (text: string) => load(text);

  return (
    <Layout current="fellowship">
      <h1 className={chronicleStyles.title}>Fellowship</h1>
      <p className={styles.lead}>
        Friends see the parts of your profile you share with friends.
        {handle && (
          <>
            {' '}
            Your profile is at <Link to="/profile">{siteAddress(`/readers/${handle}`)}</Link>.
          </>
        )}
      </p>
      <p id={MESSAGE_ID} tabIndex={-1} className={styles.message}>
        {message}
      </p>
      {failed && <p>{failed}</p>}

      {lists && lists.askingYou.length > 0 && (
        <Frame title="Asking to be your friend" className={chronicleStyles.frame}>
          <ReaderList readers={lists.askingYou} idPrefix="asking" sinceText={(date) => `Asked on ${date}`} onChanged={changed} />
        </Frame>
      )}

      <FindReaders onChanged={changed} />

      {lists && (
        <Frame title="Your fellowship" className={chronicleStyles.frame}>
          {lists.friends.length === 0 ? (
            <p className={chronicleStyles.note}>No friends yet. Find readers above, or send a friend the address of your profile.</p>
          ) : (
            <ReaderList readers={lists.friends} idPrefix="friend" sinceText={(date) => `Friends since ${date}`} onChanged={changed} />
          )}
        </Frame>
      )}

      {lists && lists.blocked.length > 0 && (
        <Frame title="Blocked readers" className={chronicleStyles.frame}>
          <p className={chronicleStyles.note}>They don’t see you, and you don’t see them. They aren’t told.</p>
          <ReaderList readers={lists.blocked} idPrefix="blocked" sinceText={(date) => `Blocked on ${date}`} onChanged={changed} />
        </Frame>
      )}

      {lists && lists.youAsked.length > 0 && (
        <Frame title="You asked" className={chronicleStyles.frame}>
          <p className={chronicleStyles.note}>They haven’t answered yet.</p>
          <ReaderList readers={lists.youAsked} idPrefix="asked" sinceText={(date) => `Asked on ${date}`} onChanged={changed} />
        </Frame>
      )}
    </Layout>
  );
}

function FindReaders({ onChanged }: { onChanged: (message: string) => Promise<void> }) {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [found, setFound] = useState<Found | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (query.length < 2) {
      setError('Type at least 2 letters of a name or address.');
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      setFound({ query, readers: await fellowship.search(query) });
    } catch (problem) {
      const errors = formErrorsFrom(problem, ['q']);
      setError(errors.fields.q ?? errors.general[0]);
    } finally {
      setPending(false);
    }
  }

  // A change in the results only changes that reader's line; the lists below are fetched again.
  async function changed(handle: string, relation: Relation, text: string) {
    setFound((now) => now && { ...now, readers: now.readers.map((r) => (r.handle === handle ? { ...r, relation } : r)) });
    await onChanged(text);
  }

  return (
    <Frame title="Find readers" className={chronicleStyles.frame}>
      <form role="search" aria-label="Find readers" noValidate onSubmit={handleSubmit} className={styles.search}>
        <TextField
          id="reader-search"
          name="q"
          type="search"
          label="Name or address"
          hint="At least 2 letters, such as Ingrid or ingrid-reads."
          autoComplete="off"
          error={error}
        />
        <Button type="submit" variant="secondary" aria-disabled={pending || undefined}>
          {pending ? 'Searching…' : 'Search'}
        </Button>
      </form>
      <p role="status" className={styles.found}>
        {found &&
          (found.readers.length === 0
            ? `No readers found for “${found.query}”.`
            : `${found.readers.length} ${found.readers.length === 1 ? 'reader' : 'readers'} found for “${found.query}”.`)}
      </p>
      {found && found.readers.length > 0 && (
        <ReaderList readers={found.readers} idPrefix="found" onChanged={(text, handle, relation) => changed(handle, relation, text)} />
      )}
    </Frame>
  );
}

interface ReaderListProps {
  readers: ReaderCard[];
  idPrefix: string;
  sinceText?: (date: string) => string;
  onChanged: (message: string, handle: string, relation: Relation) => Promise<void>;
}

function ReaderList({ readers, idPrefix, sinceText, onChanged }: ReaderListProps) {
  return (
    <ul className={styles.readers}>
      {readers.map((reader) => (
        <li key={reader.handle} className={styles.reader}>
          <Portrait id={reader.portrait} size="tiny" />
          <div className={styles.about}>
            <p className={styles.name}>
              {/* A blocked reader's profile is hidden from you too, so there is nothing to link to. */}
              {reader.relation === 'blocked' ? <strong>{reader.displayName}</strong> : <Link to={`/readers/${reader.handle}`}>{reader.displayName}</Link>}
              {sinceText && reader.since && <span className={styles.since}> · {sinceText(dateFormat.format(new Date(reader.since)))}</span>}
            </p>
            <RelationActions
              handle={reader.handle}
              name={reader.displayName}
              relation={reader.relation}
              idPrefix={idPrefix}
              fallbackFocusId={MESSAGE_ID}
              onChanged={(relation, text) => onChanged(text, reader.handle, relation)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
