import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { profile as profileApi, type ReaderProfile, type ViewedAs, type Visibility, type VisibilitySettings } from '../api/profile';
import { problemMessage } from '../components/forms/formErrors';
import { Fieldset } from '../components/forms/Fieldset';
import formStyles from '../components/forms/forms.module.css';
import { Frame } from '../components/Frame';
import { Layout } from '../components/Layout';
import { Notice } from '../components/Notice';
import { Portrait } from '../components/Portrait';
import { Stars } from '../components/Stars';
import { BlockAndReport } from '../fellowship/BlockAndReport';
import { RelationActions } from '../fellowship/RelationActions';
import { toRoman } from '../game/roman';
import { siteAddress } from '../routing/siteAddress';
import { usePageTitle } from '../routing/usePageTitle';
import chronicleStyles from './ChroniclePage.module.css';
import styles from './ProfilePage.module.css';

const numberFormat = new Intl.NumberFormat('en-GB');
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const VIEWERS: [ViewedAs, string][] = [
  ['you', 'You'],
  ['friend', 'A friend'],
  ['stranger', 'Someone else'],
];
const VIEWER_NOTES: Record<ViewedAs, string> = {
  you: 'This is your own view, with the privacy settings at the bottom.',
  friend: 'This is what your friends see.',
  stranger: 'This is what someone who isn’t your friend sees.',
};
const VISIBILITY_NAMES: Record<Visibility, string> = { everyone: 'Everyone', friends: 'Friends', onlyYou: 'Only you' };
const SETTINGS: [keyof VisibilitySettings, string, string][] = [
  ['progress', 'Year and volumes', 'Pages, goal, level and past years.'],
  ['reading', 'Reading now', 'The books on your Reading now shelf.'],
  ['reviews', 'Reviews', 'Reviews you write on book pages.'],
  ['friends', 'Fellowship', 'Who your friends are.'],
];

/**
 * A reader's profile: /profile for your own, /readers/{handle} for anyone's. The name, portrait and text are always
 * shown; the other parts follow the reader's settings. On your own profile, "See your profile as" shows it as
 * a friend or someone else would see it.
 */
export function ProfilePage() {
  const { handle: routeHandle } = useParams();
  const [handle, setHandle] = useState<string | undefined>(routeHandle);
  const [viewAs, setViewAs] = useState<ViewedAs>('you');
  const [data, setData] = useState<ReaderProfile | null | undefined>();
  const [failed, setFailed] = useState<string | undefined>();
  // Fetched again after becoming friends (or no longer), since that changes what can be seen.
  const [version, setVersion] = useState(0);
  // The name of a reader just blocked from this page: the profile gives way to a note.
  const [blocked, setBlocked] = useState<string | undefined>();
  // The Block button is gone, so the focus goes to the heading that replaces the profile, once it is drawn.
  useEffect(() => {
    if (blocked) document.getElementById('blocked-heading')?.focus();
  }, [blocked]);
  usePageTitle(blocked ? `You blocked ${blocked}` : data ? data.displayName : data === null ? 'Reader not found' : 'Profile');

  // Your own profile: find your address first.
  useEffect(() => {
    if (routeHandle) {
      setHandle(routeHandle);
      return;
    }
    let current = true;
    profileApi.settings().then(
      (settings) => current && setHandle(settings.handle),
      (problem: unknown) => current && setFailed(problemMessage(problem)),
    );
    return () => {
      current = false;
    };
  }, [routeHandle]);

  useEffect(() => {
    if (!handle) return;
    let current = true;
    profileApi.reader(handle, viewAs).then(
      (loaded) => current && setData(loaded),
      (problem: unknown) => {
        if (!current) return;
        if (problem instanceof ApiError && problem.status === 404) setData(null);
        else setFailed(problemMessage(problem));
      },
    );
    return () => {
      current = false;
    };
  }, [handle, viewAs, version]);

  return (
    <Layout current={routeHandle ? null : 'profile'}>
      {failed && <p>{failed}</p>}
      {blocked && (
        <>
          <h1 id="blocked-heading" tabIndex={-1} className={chronicleStyles.title}>
            You blocked {blocked}
          </h1>
          <p className={styles.bio}>
            You won’t see each other on Tomekeeper, and {blocked} isn’t told. To undo it, go to the{' '}
            <Link to="/fellowship">Fellowship page</Link>.
          </p>
          {handle && (
            <p>
              <Link to={`/report/${handle}`}>Report {blocked} to the moderator</Link>
            </p>
          )}
        </>
      )}
      {!blocked && data === null && (
        <>
          <h1 className={chronicleStyles.title}>Reader not found</h1>
          <p>There is no reader at this address. Check the link, or find readers on the Fellowship page.</p>
        </>
      )}
      {!blocked && data && (
        <>
          {data.isOwner && (
            <div className={styles.viewAs}>
              <div role="group" aria-label="See your profile as" className={styles.viewers}>
                <span className={styles.viewersLabel} aria-hidden="true">
                  See your profile as
                </span>
                {VIEWERS.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={viewAs === id} onClick={() => setViewAs(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <p role="status" className={styles.viewerNote}>
                {VIEWER_NOTES[viewAs]}
              </p>
            </div>
          )}
          <ProfileView
            data={data}
            onSettings={(visibility) => setData({ ...data, visibility })}
            onRelation={() => setVersion((n) => n + 1)}
            onBlocked={() => setBlocked(data.displayName)}
          />
        </>
      )}
    </Layout>
  );
}

interface ProfileViewProps {
  data: ReaderProfile;
  onSettings: (settings: VisibilitySettings) => void;
  onRelation: () => void;
  onBlocked: () => void;
}

function ProfileView({ data, onSettings, onRelation, onBlocked }: ProfileViewProps) {
  const own = data.viewedAs === 'you';
  const badge = (part: keyof VisibilitySettings) =>
    own && data.visibility ? <p className={styles.badge}>Visible to: {VISIBILITY_NAMES[data.visibility[part]]}</p> : null;
  return (
    <>
      <div className={styles.head}>
        {data.portrait && <Portrait id={data.portrait} size="large" />}
        <div className={styles.who}>
          <p className={styles.address}>
            {siteAddress(`/readers/${data.handle}`)}
          </p>
          <h1 id="profile-name" tabIndex={-1} className={chronicleStyles.title}>
            {data.displayName}
          </h1>
          {data.bio && <p className={styles.bio}>{data.bio}</p>}
          <p className={styles.since}>Keeping a chronicle since {data.since}</p>
          {own && (
            <p>
              <Link to="/profile/edit">Edit profile</Link>
            </p>
          )}
          {data.relation && (
            <RelationActions
              handle={data.handle}
              name={data.displayName}
              relation={data.relation}
              idPrefix="profile"
              fallbackFocusId="profile-name"
              onChanged={onRelation}
            />
          )}
          {!data.isOwner && <BlockAndReport handle={data.handle} name={data.displayName} onBlocked={onBlocked} />}
        </div>
      </div>

      {!own && data.somethingHidden && (
        <Notice className={styles.hidden}>
          {data.viewedAs === 'stranger'
            ? `${data.displayName} shares more with friends.`
            : `Some of ${data.displayName}’s profile is private.`}
        </Notice>
      )}

      {data.year && (
        <Frame title="The year so far" className={chronicleStyles.frame}>
          <p className={styles.bigLine}>
            <strong className={chronicleStyles.big}>{numberFormat.format(data.year.pagesRead)}</strong>{' '}
            {data.year.goalPages
              ? `pages of a ${numberFormat.format(data.year.goalPages)}-page goal · ${Math.min(100, Math.floor((data.year.pagesRead / data.year.goalPages) * 100))} percent`
              : 'pages this year'}
          </p>
          <p className={chronicleStyles.note}>
            {data.year.booksFinished} {data.year.booksFinished === 1 ? 'book' : 'books'} finished · Level {data.year.level},{' '}
            {data.year.title}
          </p>
          {badge('progress')}
        </Frame>
      )}

      {data.readingNow && (
        <Frame title="Reading now" className={chronicleStyles.frame}>
          {data.readingNow.length === 0 ? (
            <p className={chronicleStyles.note}>Nothing on Reading now.</p>
          ) : (
            <ul className={styles.list}>
              {data.readingNow.map((book, index) => (
                <li key={book.bookId ?? index}>
                  <strong>{book.bookId ? <Link to={`/books/${book.bookId}`}>{book.title}</Link> : book.title}</strong>
                  <span className={styles.muted}>
                    {' · '}
                    {book.authors.join(', ') || 'Unknown author'}
                    {book.percent !== null && ` · ${book.percent} percent`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {badge('reading')}
        </Frame>
      )}

      {data.volumes && (
        <Frame title="Volumes" className={chronicleStyles.frame}>
          <ul className={styles.list}>
            {data.volumes.map((volume) => (
              <li key={volume.year}>
                <strong>
                  Volume {toRoman(volume.year)} <span className="visually-hidden">({volume.year})</span>
                </strong>
                <span className={styles.muted}>
                  {volume.year === data.year?.year ? ' · Still being written' : ''} · {numberFormat.format(volume.pages)} pages ·{' '}
                  {volume.books} books · Reached level {volume.level}
                </span>
              </li>
            ))}
          </ul>
          {badge('progress')}
        </Frame>
      )}

      {data.reviews && (
        <Frame title="Reviews" className={chronicleStyles.frame}>
          {data.reviews.length === 0 ? (
            <p className={chronicleStyles.note}>No reviews yet.</p>
          ) : (
            <ul className={styles.reviews}>
              {data.reviews.map((review, index) => (
                <li key={review.bookId ?? index}>
                  <p className={styles.reviewOf}>
                    <strong>{review.bookId ? <Link to={`/books/${review.bookId}`}>{review.title}</Link> : review.title}</strong>
                    <span className={styles.muted}> · {review.authors.join(', ') || 'Unknown author'}</span>
                  </p>
                  <p className={styles.reviewMeta}>
                    <Stars rating={review.rating} /> <span className={styles.muted}>{dateFormat.format(new Date(review.writtenAt))}</span>
                  </p>
                  {review.text && <p className={styles.reviewText}>{review.text}</p>}
                </li>
              ))}
            </ul>
          )}
          {badge('reviews')}
        </Frame>
      )}

      {data.fellowship && (
        <Frame title="Fellowship" className={chronicleStyles.frame}>
          {data.fellowship.length === 0 ? (
            <p className={chronicleStyles.note}>No friends yet.</p>
          ) : (
            <ul className={styles.friends}>
              {data.fellowship.map((friend) => (
                <li key={friend.handle}>
                  <Portrait id={friend.portrait} size="tiny" />
                  <Link to={`/readers/${friend.handle}`}>{friend.displayName}</Link>
                  {friend.relation === 'you' && <span className={styles.muted}> (you)</span>}
                </li>
              ))}
            </ul>
          )}
          {own && (
            <p>
              <Link to="/fellowship">Find readers and answer requests</Link>
            </p>
          )}
          {badge('friends')}
        </Frame>
      )}

      {own && data.visibility && <WhoCanSee settings={data.visibility} onSaved={onSettings} />}
    </>
  );
}

function WhoCanSee({ settings, onSaved }: { settings: VisibilitySettings; onSaved: (settings: VisibilitySettings) => void }) {
  const [message, setMessage] = useState('');
  // The choice shows at once; it goes back if the save fails.
  const [chosen, setChosen] = useState(settings);

  async function choose(part: keyof VisibilitySettings, label: string, visibility: Visibility) {
    const before = chosen[part];
    setChosen((now) => ({ ...now, [part]: visibility }));
    setMessage('');
    try {
      const saved = await profileApi.setVisibility({ [part]: visibility });
      onSaved(saved.visibility);
      setMessage(`Saved: ${label} is visible to ${VISIBILITY_NAMES[visibility]}.`);
    } catch (problem) {
      setChosen((now) => ({ ...now, [part]: before }));
      setMessage(`Not saved: ${problemMessage(problem)}`);
    }
  }

  return (
    <Frame title="Who can see what" className={chronicleStyles.frame}>
      <p className={chronicleStyles.note}>
        Your name, portrait and the short text about you are always visible, so friends can find you. Everything else starts
        as Friends only. Changes apply at once.
      </p>
      <div className={styles.settings}>
        {SETTINGS.map(([part, label, hint]) => (
          <Fieldset key={part} legend={label} hint={hint}>
            {(Object.keys(VISIBILITY_NAMES) as Visibility[]).map((visibility) => (
              <label key={visibility} className={formStyles.radio}>
                <input
                  type="radio"
                  name={`visibility-${part}`}
                  value={visibility}
                  checked={chosen[part] === visibility}
                  onChange={() => void choose(part, label, visibility)}
                />
                {VISIBILITY_NAMES[visibility]}
              </label>
            ))}
          </Fieldset>
        ))}
      </div>
      <p role="status" className={styles.saved}>
        {message}
      </p>
    </Frame>
  );
}
