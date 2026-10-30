import { ApiError, apiRequest } from './client';

export type PortraitId = 'astrologer' | 'knight' | 'emperor';

/** The signed-in reader, as /api/account/me returns it. */
export interface Reader {
  id: string;
  displayName: string;
  email: string;
  emailConfirmed: boolean;
  /** Null until the reader has taken the first steps after signing up. */
  portrait: PortraitId | null;
  /** False for readers who only sign in with Google. */
  hasPassword: boolean;
}

/** Which ways to sign in the API offers. Google is only there when it has been set up. */
export interface SignInOptions {
  google: boolean;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
  /** Keep the reader signed in after the browser closes. */
  rememberMe: boolean;
}

/** The account routes of the API. Each one matches an endpoint in api/Tomekeeper.Api/Accounts/AccountEndpoints.cs. */
export const account = {
  me: () => apiRequest<Reader>('GET', '/api/account/me'),
  register: (input: RegisterInput) => apiRequest<Reader>('POST', '/api/account/register', input),
  signIn: (input: SignInInput) => apiRequest('POST', '/api/account/sign-in', input),
  signOut: () => apiRequest('POST', '/api/account/sign-out'),
  confirmEmail: (input: { userId: string; code: string }) => apiRequest('POST', '/api/account/confirm-email', input),
  resendConfirmation: () => apiRequest('POST', '/api/account/resend-confirmation'),
  forgotPassword: (input: { email: string }) => apiRequest('POST', '/api/account/forgot-password', input),
  resetPassword: (input: { email: string; code: string; password: string }) =>
    apiRequest('POST', '/api/account/reset-password', input),
  setPortrait: (portrait: PortraitId) => apiRequest<Reader>('PUT', '/api/account/portrait', { portrait }),
  signInOptions: () => apiRequest<SignInOptions>('GET', '/api/account/sign-in-options'),
  /** Deletes the account and everything in it. The password is needed when the account has one. */
  deleteAccount: (input: { email: string; password: string | null }) => apiRequest('POST', '/api/account/delete', input),
};

/**
 * The address of the "Sign in with Google" button. It is an ordinary link: the browser leaves the site, the
 * reader signs in on Google's page, and the API brings them back to `returnTo`.
 */
export function googleSignInUrl(returnTo: string): string {
  return `/api/account/google/start?returnUrl=${encodeURIComponent(returnTo)}`;
}

/** Asks the API who is signed in. Resolves to null when nobody is. */
export async function fetchReader(): Promise<Reader | null> {
  try {
    return await account.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
