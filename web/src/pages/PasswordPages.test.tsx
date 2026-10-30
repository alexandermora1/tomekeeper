import { screen } from '@testing-library/react';
import { fakeApi, problem, validationProblem } from '../test/fakeApi';
import { renderApp } from '../test/renderApp';

const BROKEN = "This reset link doesn't work any more. Ask for a new one.";

describe('the forgot password page', () => {
  it('sends the link and gives the same answer whether or not there is an account', async () => {
    fakeApi.on('POST', '/api/account/forgot-password', { status: 204 });
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('Email'), 'ingrid@example.no');
    await user.click(screen.getByRole('button', { name: 'Send the link' }));

    expect(await screen.findByText(/If there is an account for/)).toHaveTextContent(
      "If there is an account for ingrid@example.no, we've sent it a link to choose a new password.",
    );
    expect(fakeApi.sent('POST', '/api/account/forgot-password')[0]?.body).toEqual({ email: 'ingrid@example.no' });
  });

  it('asks for the email when it is missing', async () => {
    fakeApi.on('POST', '/api/account/forgot-password', validationProblem({ email: ['Enter your email address.'] }));
    const { user } = renderApp('/forgot-password');

    await user.click(await screen.findByRole('button', { name: 'Send the link' }));

    expect(await screen.findByRole('group', { name: 'There is a problem' })).toHaveTextContent('Enter your email address.');
  });
});

describe('the reset password page', () => {
  const link = '/reset-password?email=ingrid%40example.no&code=abc123';

  it('saves the new password with the email and code from the link', async () => {
    fakeApi.on('POST', '/api/account/reset-password', { status: 204 });
    const { user } = renderApp(link);

    expect(await screen.findByText('ingrid@example.no')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'copper kettle under moonlight');
    await user.click(screen.getByRole('button', { name: 'Save the new password' }));

    expect(await screen.findByText('Your password is changed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with the new password' })).toHaveAttribute('href', '/sign-in');
    expect(fakeApi.sent('POST', '/api/account/reset-password')[0]?.body).toEqual({
      email: 'ingrid@example.no',
      code: 'abc123',
      password: 'copper kettle under moonlight',
    });
  });

  it('shows the password rules from the API', async () => {
    fakeApi.on(
      'POST',
      '/api/account/reset-password',
      validationProblem({ password: ['Make the password at least 15 characters. It has 5.'] }),
    );
    const { user } = renderApp(link);

    await user.type(await screen.findByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save the new password' }));

    expect(await screen.findByRole('group', { name: 'There is a problem' })).toHaveTextContent(
      'Make the password at least 15 characters. It has 5.',
    );
  });

  it('offers a new link when the API says the link is too old', async () => {
    fakeApi.on('POST', '/api/account/reset-password', problem(400, BROKEN));
    const { user } = renderApp(link);

    await user.type(await screen.findByLabelText('New password'), 'copper kettle under moonlight');
    await user.click(screen.getByRole('button', { name: 'Save the new password' }));

    expect(await screen.findByText(BROKEN)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('explains a link that is missing its code', async () => {
    renderApp('/reset-password?email=ingrid%40example.no');
    expect(await screen.findByText(BROKEN)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
