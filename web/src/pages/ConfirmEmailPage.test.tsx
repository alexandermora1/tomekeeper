import { screen, within } from '@testing-library/react';
import { fakeApi, problem, sampleReader } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const USER_ID = '01a18876-6037-7327-a574-7e6c7a1054a2';
const LINK = `/confirm-email?userId=${USER_ID}&code=abc123`;
const BROKEN = "This confirmation link doesn't work any more. Sign in and ask for a new one.";

describe('the confirm email page', () => {
  it('waits for the reader to press the button before confirming', async () => {
    fakeApi.on('POST', '/api/account/confirm-email', { status: 204 });
    const { user } = renderApp(LINK);

    const button = await screen.findByRole('button', { name: 'Confirm my email' });
    expect(fakeApi.sent('POST', '/api/account/confirm-email')).toHaveLength(0);

    await user.click(button);

    const outcome = await screen.findByText('Your email address is confirmed. Thank you.');
    expect(outcome.parentElement).toHaveFocus();
    expect(fakeApi.sent('POST', '/api/account/confirm-email')[0]?.body).toEqual({ userId: USER_ID, code: 'abc123' });
    expect(within(outcome.parentElement!).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('updates a signed-in reader so the chronicle stops asking', async () => {
    fakeApi.signedIn({ ...sampleReader, emailConfirmed: false });
    fakeApi.on('POST', '/api/account/confirm-email', () => {
      fakeApi.signedIn({ ...sampleReader, emailConfirmed: true });
      return { status: 204 };
    });
    const { user } = renderApp(LINK);

    await user.click(await screen.findByRole('button', { name: 'Confirm my email' }));
    await user.click(await screen.findByRole('link', { name: 'Go to your chronicle' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Your chronicle' })).toBeInTheDocument();
    expect(screen.queryByText('Confirm your email address.')).not.toBeInTheDocument();
  });

  it('shows the message from the API when the link is too old', async () => {
    fakeApi.on('POST', '/api/account/confirm-email', problem(400, BROKEN));
    const { user } = renderApp(LINK);

    await user.click(await screen.findByRole('button', { name: 'Confirm my email' }));

    expect(await screen.findByText(BROKEN)).toBeInTheDocument();
  });

  it('explains a broken link without asking the API', async () => {
    renderApp('/confirm-email?userId=nope&code=abc');
    expect(await screen.findByText(BROKEN)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm my email' })).not.toBeInTheDocument();
  });
});

describe('the reminder to confirm', () => {
  it('sends a new link and says so', async () => {
    fakeApi.signedIn({ ...sampleReader, emailConfirmed: false });
    fakeApi.on('POST', '/api/account/resend-confirmation', { status: 204 });
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(`We sent a new link to ${sampleReader.email}.`);
    expect(fakeApi.sent('POST', '/api/account/resend-confirmation')).toHaveLength(1);
  });
});
