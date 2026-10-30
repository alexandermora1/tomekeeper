import { screen, within } from '@testing-library/react';
import { REQUEST_HEADER } from '../api/client';
import { fakeApi, problem, sampleReader, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const WRONG = "That email and password don't match an account.";

describe('the sign-in page', () => {
  it('signs in and opens the chronicle', async () => {
    fakeApi.on('POST', '/api/account/sign-in', () => {
      fakeApi.signedIn();
      return { status: 204 };
    });
    const { user } = renderApp('/sign-in');

    await user.type(await screen.findByLabelText('Email'), 'ingrid@example.no');
    await user.type(screen.getByLabelText('Password'), 'lantern harbour winter quill');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Your chronicle' })).toBeInTheDocument();
    const [request] = fakeApi.sent('POST', '/api/account/sign-in');
    expect(request?.body).toEqual({ email: 'ingrid@example.no', password: 'lantern harbour winter quill', rememberMe: true });
    expect(request?.headers.get(REQUEST_HEADER)).toBe('1');
  });

  it('asks for a short session when "Keep me signed in" is unticked', async () => {
    fakeApi.on('POST', '/api/account/sign-in', problem(401, WRONG, 'Not signed in'));
    const { user } = renderApp('/sign-in');

    await user.click(await screen.findByRole('checkbox', { name: 'Keep me signed in on this device' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText(WRONG);
    expect(fakeApi.sent('POST', '/api/account/sign-in')[0]?.body).toMatchObject({ rememberMe: false });
  });

  it('shows a wrong password in the error summary and moves focus there', async () => {
    fakeApi.on('POST', '/api/account/sign-in', problem(401, WRONG, 'Not signed in'));
    const { user } = renderApp('/sign-in');

    await user.type(await screen.findByLabelText('Email'), 'ingrid@example.no');
    await user.type(screen.getByLabelText('Password'), 'not the right one at all');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const summary = await screen.findByRole('group', { name: 'There is a problem' });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent(WRONG);
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('shows field errors next to the fields and links to them from the summary', async () => {
    fakeApi.on(
      'POST',
      '/api/account/sign-in',
      validationProblem({ email: ['Enter your email address.'], password: ['Enter your password.'] }),
    );
    const { user } = renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    const summary = await screen.findByRole('group', { name: 'There are 2 problems' });
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Error: Enter your email address.');

    await user.click(within(summary).getByRole('link', { name: 'Enter your password.' }));
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('explains when the API cannot be reached', async () => {
    fakeApi.on('POST', '/api/account/sign-in', 'network-error');
    const { user } = renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('group', { name: 'There is a problem' })).toHaveTextContent(
      "Tomekeeper couldn't be reached.",
    );
  });

  it('goes back to the page the reader was sent away from', async () => {
    fakeApi.on('POST', '/api/account/sign-in', () => {
      fakeApi.signedIn({ ...sampleReader, emailConfirmed: false });
      return { status: 204 };
    });
    const { user } = renderApp('/');

    await user.type(await screen.findByLabelText('Email'), 'ingrid@example.no');
    await user.type(screen.getByLabelText('Password'), 'lantern harbour winter quill');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Confirm your email address.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('shows and hides the password', async () => {
    const { user } = renderApp('/sign-in');
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('uses autocomplete values that password managers understand', async () => {
    renderApp('/sign-in');
    expect(await screen.findByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });
});
