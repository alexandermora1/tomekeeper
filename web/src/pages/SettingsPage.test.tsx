import { screen, within } from '@testing-library/react';
import { fakeApi, problem, sampleReader, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

describe('the settings page', () => {
  it('shows the account', async () => {
    fakeApi.signedIn();
    renderApp('/settings');

    const details = await screen.findByRole('region', { name: 'Your account' });
    expect(details).toHaveTextContent(sampleReader.displayName);
    expect(details).toHaveTextContent(`${sampleReader.email} (confirmed)`);
    expect(document.title).toBe('Settings – Tomekeeper');
  });

  it('is only for signed-in readers', async () => {
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('deletes the account and says so on the sign-in page', async () => {
    fakeApi.signedIn().on('POST', '/api/account/delete', () => {
      fakeApi.signedOut();
      return { status: 204 };
    });
    const { user } = renderApp('/settings');

    await user.type(await screen.findByLabelText('Type your email address to confirm'), sampleReader.email);
    await user.type(screen.getByLabelText('Your password'), 'lantern harbour winter quill');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your account is deleted, together with everything in it.');
    expect(window.location.pathname).toBe('/sign-in');
    expect(fakeApi.sent('POST', '/api/account/delete')[0]?.body).toEqual({
      email: sampleReader.email,
      password: 'lantern harbour winter quill',
    });
  });

  it('shows what was wrong and keeps the account', async () => {
    fakeApi
      .signedIn()
      .on('POST', '/api/account/delete', validationProblem({ password: ["That password isn't right."] }));
    const { user } = renderApp('/settings');

    await user.type(await screen.findByLabelText('Type your email address to confirm'), sampleReader.email);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(within(summary).getByRole('link', { name: "That password isn't right." })).toHaveAttribute('href', '#delete-password');
    expect(window.location.pathname).toBe('/settings');
  });

  it('asks Google-only readers for their email address alone', async () => {
    fakeApi.signedIn({ ...sampleReader, hasPassword: false }).on('POST', '/api/account/delete', { status: 204 });
    const { user } = renderApp('/settings');

    expect(await screen.findByText(/None: you sign in with Google/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your password')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Type your email address to confirm'), sampleReader.email);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));

    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(fakeApi.sent('POST', '/api/account/delete')[0]?.body).toEqual({ email: sampleReader.email, password: null });
  });

  it('explains when there have been too many attempts', async () => {
    fakeApi
      .signedIn()
      .on('POST', '/api/account/delete', problem(429, 'Too many attempts from this connection. Wait a little and try again.', 'Too many requests'));
    const { user } = renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('group', { name: 'There is a problem' })).toHaveTextContent(
      'Too many attempts from this connection. Wait a little and try again.',
    );
  });
});
