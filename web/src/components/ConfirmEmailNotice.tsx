import { useState } from 'react';
import { account } from '../api/account';
import { ApiError } from '../api/client';
import { Button } from './Button';
import { OFFLINE_MESSAGE, SERVER_MESSAGE } from './forms/formErrors';
import { Notice } from './Notice';

/** Reminds a signed-in reader to confirm their email address, with a button to send the link again. */
export function ConfirmEmailNotice({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    if (state === 'sending') return;
    setState('sending');
    try {
      await account.resendConfirmation();
      setState('sent');
      setMessage(`We sent a new link to ${email}.`);
    } catch (error) {
      setState('failed');
      setMessage(error instanceof ApiError ? SERVER_MESSAGE : OFFLINE_MESSAGE);
    }
  }

  return (
    <Notice>
      <p>
        <strong>Confirm your email address.</strong> We sent a link to {email}. Open it to show that the address is
        yours.
      </p>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <p role="status">{message}</p>
      <Button variant="secondary" onClick={() => void resend()} aria-disabled={state === 'sending' || undefined}>
        {state === 'sending' ? 'Sending…' : 'Send a new link'}
      </Button>
    </Notice>
  );
}
