/** Text that more than one account page uses. */

/** What the sign-in page says when Google sign-in didn't work. The API sends the reader back with ?google=… */
export const GOOGLE_PROBLEMS: Record<string, string> = {
  cancelled: 'Signing in with Google was cancelled. Try again, or use your email.',
  failed: "Signing in with Google didn't work. Try again, or use your email.",
  email: "Your Google account didn't share a confirmed email address, so it can't be used here. Use your email instead.",
  unconfirmed:
    "There is already an account with this email, but the address hasn't been confirmed. Sign in with your password, or reset it, and then you can use Google.",
  locked: 'Too many attempts. Wait 15 minutes, or reset your password.',
  unavailable: "Signing in with Google isn't available right now. Use your email instead.",
};

export const PASSWORD_HINT =
  'At least 15 characters. A few words in a row is easy to remember. Pasting from a password manager works.';
