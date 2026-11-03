import { useState } from 'react';
import { Link } from 'react-router';
import { fellowship } from '../api/fellowship';
import { Button } from '../components/Button';
import { problemMessage } from '../components/forms/formErrors';
import styles from './RelationActions.module.css';

interface BlockAndReportProps {
  handle: string;
  name: string;
  onBlocked: () => void;
}

/** On another reader's profile: report them to the moderator, or block them (after asking). */
export function BlockAndReport({ handle, name, onBlocked }: BlockAndReportProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const questionId = `block-${handle}`;

  async function block() {
    if (busy) return;
    setBusy(true);
    try {
      await fellowship.block(handle);
      onBlocked();
    } catch (problem) {
      setError(problemMessage(problem));
      setBusy(false);
    }
  }

  return (
    <div className={styles.more}>
      {asking && (
        <p id={questionId} tabIndex={-1} className={styles.question}>
          Block {name}? You won’t see each other’s profiles, reviews or names in searches, and any friendship or requests
          between you end. {name} isn’t told. You can unblock on the Fellowship page.
        </p>
      )}
      <div className={styles.buttons}>
        {asking ? (
          <>
            <Button variant="danger" aria-disabled={busy || undefined} onClick={() => void block()}>
              Yes, block <span className="visually-hidden">{name}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAsking(false);
                requestAnimationFrame(() => document.getElementById(`${questionId}-button`)?.focus());
              }}
            >
              Don’t block
            </Button>
          </>
        ) : (
          <>
            <Link to={`/report/${handle}`} className={styles.report}>
              Report <span className="visually-hidden">{name}</span>
            </Link>
            <Button
              id={`${questionId}-button`}
              variant="secondary"
              onClick={() => {
                setAsking(true);
                requestAnimationFrame(() => document.getElementById(questionId)?.focus());
              }}
            >
              Block <span className="visually-hidden">{name}</span>
            </Button>
          </>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
