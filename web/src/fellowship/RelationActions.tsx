import { useState } from 'react';
import { fellowship, type Relation } from '../api/fellowship';
import { Button } from '../components/Button';
import { problemMessage } from '../components/forms/formErrors';
import styles from './RelationActions.module.css';

interface RelationActionsProps {
  handle: string;
  name: string;
  relation: Relation;
  /** Makes the ids unique when the same reader is in more than one list. */
  idPrefix: string;
  /** Called with the new relation. The page may move the reader to another list or remove them. */
  onChanged: (relation: Relation, message: string) => Promise<void> | void;
  /** Where the focus goes when this reader's line is gone after the change. */
  fallbackFocusId: string;
}

/**
 * What the reader can do with another: ask to be friends, withdraw, accept or ignore, or remove a friend (after
 * asking). A line says how the two stand; after each change the focus moves to it, so screen readers hear the
 * new state.
 */
export function RelationActions({ handle, name, relation, idPrefix, onChanged, fallbackFocusId }: RelationActionsProps) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lineId = `${idPrefix}-${handle}`;

  async function act(action: () => Promise<Relation>, message: (relation: Relation) => string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const changed = await action();
      setConfirming(false);
      await onChanged(changed, message(changed));
      requestAnimationFrame(() => (document.getElementById(lineId) ?? document.getElementById(fallbackFocusId))?.focus());
    } catch (problem) {
      setError(problemMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || undefined;
  const ask = () =>
    act(
      () => fellowship.ask(handle),
      (r) => (r === 'friend' ? `${name} had asked you too, so you are friends now.` : `You asked ${name} to be friends.`),
    );

  if (relation === 'you') return null;
  return (
    <div className={styles.actions}>
      <p id={lineId} tabIndex={-1} className={styles.line}>
        {confirming ? `Remove ${name} from your fellowship? They aren’t told, but they will only see what you share with everyone.` : LINES[relation](name)}
      </p>
      <div className={styles.buttons}>
        {relation === 'none' && (
          <Button variant="secondary" aria-disabled={disabled} onClick={() => void ask()}>
            Ask to be friends <span className="visually-hidden">with {name}</span>
          </Button>
        )}
        {relation === 'asked' && (
          <Button variant="secondary" aria-disabled={disabled} onClick={() => void act(() => fellowship.leave(handle), () => `You withdrew your request to ${name}.`)}>
            Withdraw request <span className="visually-hidden">to {name}</span>
          </Button>
        )}
        {relation === 'asksYou' && (
          <>
            <Button aria-disabled={disabled} onClick={() => void act(() => fellowship.accept(handle), () => `You and ${name} are friends now.`)}>
              Accept <span className="visually-hidden">{name}</span>
            </Button>
            <Button variant="secondary" aria-disabled={disabled} onClick={() => void act(() => fellowship.ignore(handle), () => `You ignored ${name}’s request. ${name} isn’t told.`)}>
              Ignore <span className="visually-hidden">{name}</span>
            </Button>
          </>
        )}
        {relation === 'blocked' && (
          <Button variant="secondary" aria-disabled={disabled} onClick={() => void act(() => fellowship.unblock(handle), () => `You unblocked ${name}.`)}>
            Unblock <span className="visually-hidden">{name}</span>
          </Button>
        )}
        {relation === 'friend' && !confirming && (
          <Button
            variant="secondary"
            aria-disabled={disabled}
            onClick={() => {
              setConfirming(true);
              requestAnimationFrame(() => document.getElementById(lineId)?.focus());
            }}
          >
            Remove <span className="visually-hidden">{name} from your fellowship</span>
          </Button>
        )}
        {relation === 'friend' && confirming && (
          <>
            <Button variant="danger" aria-disabled={disabled} onClick={() => void act(() => fellowship.leave(handle), () => `${name} is no longer in your fellowship.`)}>
              Yes, remove <span className="visually-hidden">{name}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(false);
                requestAnimationFrame(() => document.getElementById(lineId)?.focus());
              }}
            >
              Keep <span className="visually-hidden">{name}</span>
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

const LINES: Record<Exclude<Relation, 'you'>, (name: string) => string> = {
  none: () => 'Not in your fellowship.',
  asked: (name) => `You asked ${name} to be friends.`,
  asksYou: (name) => `${name} asks to be your friend.`,
  friend: (name) => `${name} is in your fellowship.`,
  blocked: (name) => `You blocked ${name}. You don’t see each other.`,
};
