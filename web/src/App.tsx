import { BrowserRouter, Route, Routes } from 'react-router';
import { BookPage } from './pages/BookPage';
import { ChroniclePage } from './pages/ChroniclePage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { FirstStepsPage } from './pages/FirstStepsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LibraryPage } from './pages/LibraryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignInPage } from './pages/SignInPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignUpPage } from './pages/SignUpPage';
import { FocusOnNavigate } from './routing/FocusOnNavigate';
import { RequireReader, RequireSignedOut } from './session/guards';
import { SessionProvider } from './session/SessionProvider';

/**
 * The pages of the site.
 *
 * useTransitions={false} makes page changes happen at once, in the same render as changes to the session.
 * So after signing in, the reader goes straight to the next page, without a moment where the sign-in
 * page sees a signed-in reader and redirects on its own.
 */
export function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <SessionProvider>
        <FocusOnNavigate />
        <Routes>
          <Route
            path="/"
            element={
              <RequireReader>
                <ChroniclePage />
              </RequireReader>
            }
          />
          <Route
            path="/first-steps"
            element={
              <RequireReader beforeFirstSteps>
                <FirstStepsPage />
              </RequireReader>
            }
          />
          <Route
            path="/library"
            element={
              <RequireReader>
                <LibraryPage />
              </RequireReader>
            }
          />
          <Route
            path="/books/:id"
            element={
              <RequireReader>
                <BookPage />
              </RequireReader>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireReader>
                <SettingsPage />
              </RequireReader>
            }
          />
          <Route
            path="/sign-in"
            element={
              <RequireSignedOut>
                <SignInPage />
              </RequireSignedOut>
            }
          />
          <Route
            path="/sign-up"
            element={
              <RequireSignedOut>
                <SignUpPage />
              </RequireSignedOut>
            }
          />
          {/* These three open from links in emails, so they work whether or not the reader is signed in. */}
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
