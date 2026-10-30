import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { account } from '../api/account';
import { ApiError } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { Button, ButtonLink } from '../components/Button';
import { ConfirmEmailNotice } from '../components/ConfirmEmailNotice';
import { OFFLINE_MESSAGE, SERVER_MESSAGE } from '../components/forms/formErrors';
import formStyles from '../components/forms/forms.module.css';
import { Outcome } from '../components/Notice';
import { usePageTitle } from '../routing/usePageTitle';
import { useSession } from '../session/sessionContext';

const BROKEN_LINK = "This confirmation link doesn't work any more. Sign in and ask for a new one.";
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { kind: 'confirmed' } | { kind: 'broken'; message: string } | { kind: 'failed'; message: string };

/**
 * Opened from the link in the confirmation email: /confirm-email?userId=…&code=…
 *
 * The reader presses a button to confirm, instead of the page doing it as it opens. Some email services
 * open every link in an email to check it for viruses, and that shouldn't count as the reader confirming.
 */
export function ConfirmEmailPage() {
  usePageTitle('Confirm your email');
  const { status, reader, refresh } = useSession();
  const [params] = useSearchParams();
  const userId = params.get('userId') ?? '';
  const code = params.get('code') ?? '';
  const linkLooksRight = USER_ID.test(userId) && code.length > 0;

  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    try {
      await account.confirmEmail({ userId, code });
      setResult({ kind: 'confirmed' });
      // If this reader is signed in, the chronicle should stop asking them to confirm.
      if (status === 'signed-in') await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) setResult({ kind: 'broken', message: error.message });
      else if (error instanceof ApiError) setResult({ kind: 'failed', message: SERVER_MESSAGE });
      else setResult({ kind: 'failed', message: OFFLINE_MESSAGE });
    } finally {
      setPending(false);
    }
  }

  const nextStep =
    status === 'signed-in' ? (
      <ButtonLink to="/">Go to your chronicle</ButtonLink>
    ) : (
      <ButtonLink to="/sign-in">Sign in</ButtonLink>
    );

  let content;
  if (!linkLooksRight || result?.kind === 'broken') {
    content = (
      <Outcome takeFocus={result !== null}>
        <p>{result?.kind === 'broken' ? result.message : BROKEN_LINK}</p>
        {/* A signed-in reader whose email isn't confirmed can ask for a new link right here. */}
        {reader && !reader.emailConfirmed ? <ConfirmEmailNotice email={reader.email} /> : nextStep}
      </Outcome>
    );
  } else if (result?.kind === 'confirmed') {
    content = (
      <Outcome>
        <p>Your email address is confirmed. Thank you.</p>
        {nextStep}
      </Outcome>
    );
  } else {
    content = (
      <div className={formStyles.form}>
        <p className={formStyles.note}>Press the button to confirm that this email address is yours.</p>
        {result?.kind === 'failed' && (
          <p role="alert" className={formStyles.problem}>
            {result.message}
          </p>
        )}
        <Button onClick={() => void confirm()} aria-disabled={pending || undefined}>
          {pending ? 'Confirming…' : 'Confirm my email'}
        </Button>
      </div>
    );
  }

  return <AuthLayout title="Confirm your email">{content}</AuthLayout>;
}
