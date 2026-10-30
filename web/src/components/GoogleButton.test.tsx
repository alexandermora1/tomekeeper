import { screen, waitFor } from '@testing-library/react';
import { fakeApi } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

describe('the Google button', () => {
  it('is there when the API has Google sign-in set up', async () => {
    fakeApi.on('GET', '/api/account/sign-in-options', { status: 200, body: { google: true } });
    renderApp('/sign-in');

    const button = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(button).toHaveAttribute('href', '/api/account/google/start?returnUrl=%2F');
    expect(screen.getByText('or with your email')).toBeInTheDocument();
  });

  it('says "Sign up with Google" on the sign-up page', async () => {
    fakeApi.on('GET', '/api/account/sign-in-options', { status: 200, body: { google: true } });
    renderApp('/sign-up');
    expect(await screen.findByRole('link', { name: 'Sign up with Google' })).toBeInTheDocument();
  });

  it('comes back to the page the reader was sent away from', async () => {
    fakeApi.on('GET', '/api/account/sign-in-options', { status: 200, body: { google: true } });
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
      'href',
      '/api/account/google/start?returnUrl=%2F',
    );
  });

  it('is not there when Google sign-in is not set up', async () => {
    fakeApi.on('GET', '/api/account/sign-in-options', { status: 200, body: { google: false } });
    renderApp('/sign-in');

    await screen.findByRole('heading', { name: 'Welcome back' });
    await waitFor(() => expect(fakeApi.sent('GET', '/api/account/sign-in-options').length).toBeGreaterThan(0));
    expect(screen.queryByRole('link', { name: /Google/ })).not.toBeInTheDocument();
    expect(screen.queryByText('or with your email')).not.toBeInTheDocument();
  });
});

describe('coming back from Google', () => {
  it.each([
    ['cancelled', 'Signing in with Google was cancelled. Try again, or use your email.'],
    ['unconfirmed', "There is already an account with this email, but the address hasn't been confirmed."],
    ['something-new', "Signing in with Google didn't work. Try again, or use your email."],
  ])('explains ?google=%s in the error summary', async (problem, message) => {
    renderApp(`/sign-in?google=${problem}`);

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(summary).toHaveTextContent(message);
    expect(summary).toHaveFocus();
  });
});
