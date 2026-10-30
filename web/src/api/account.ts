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
};

/** Asks the API who is signed in. Resolves to null when nobody is. */
export async function fetchReader(): Promise<Reader | null> {
  try {
    return await account.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
