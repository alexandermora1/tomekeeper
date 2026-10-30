import { screen, within } from '@testing-library/react';
import { fakeApi, sampleReader, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

describe('the sign-up page', () => {
  it('creates the account and asks the new reader to confirm their email', async () => {
    const newReader = { ...sampleReader, displayName: 'Alex', email: 'alex@example.no', emailConfirmed: false };
    fakeApi.on('POST', '/api/account/register', () => {
      fakeApi.signedIn(newReader);
      return { status: 201, body: newReader };
    });
    const { user } = renderApp('/sign-up');

    await user.type(await screen.findByLabelText('Your name on the site'), 'Alex');
    await user.type(screen.getByLabelText('Email'), 'alex@example.no');
    await user.type(screen.getByLabelText('Password'), 'lantern harbour winter quill');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Your chronicle' })).toBeInTheDocument();
    expect(screen.getByText('Confirm your email address.')).toBeInTheDocument();
    expect(fakeApi.sent('POST', '/api/account/register')[0]?.body).toEqual({
      displayName: 'Alex',
      email: 'alex@example.no',
      password: 'lantern harbour winter quill',
    });
  });

  it('lists every problem from the API in the order of the fields', async () => {
    fakeApi.on(
      'POST',
      '/api/account/register',
      validationProblem({
        password: ['That password is too easy to guess. Try a few unrelated words.'],
        displayName: ['Enter the name to show on your profile.'],
        email: ['Enter an email address like name@example.no.'],
      }),
    );
    const { user } = renderApp('/sign-up');

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    const summary = await screen.findByRole('group', { name: 'There are 3 problems' });
    expect(within(summary).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '#display-name',
      '#email',
      '#password',
    ]);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 15 characters. A few words in a row is easy to remember. Pasting from a password manager works. ' +
        'Error: That password is too easy to guess. Try a few unrelated words.',
    );
  });

  it('keeps what the reader typed after a failed submit', async () => {
    fakeApi.on('POST', '/api/account/register', validationProblem({ password: ['Choose a password.'] }));
    const { user } = renderApp('/sign-up');

    await user.type(await screen.findByLabelText('Your name on the site'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByRole('group', { name: 'There is a problem' });
    expect(screen.getByLabelText('Your name on the site')).toHaveValue('Alex');
  });

  it('switches to the sign-in page with a link', async () => {
    const { user } = renderApp('/sign-up');
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
