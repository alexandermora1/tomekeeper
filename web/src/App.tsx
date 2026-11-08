import { BrowserRouter, Route, Routes } from 'react-router';
import { AddBookPage } from './pages/AddBookPage';
import { BookPage } from './pages/BookPage';
import { ChroniclePage } from './pages/ChroniclePage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { FirstStepsPage } from './pages/FirstStepsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LibraryPage } from './pages/LibraryPage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { CreditsPage } from './pages/CreditsPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { FellowshipPage } from './pages/FellowshipPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportPage } from './pages/ReportPage';
import { QuestsPage } from './pages/QuestsPage';
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
    <BrowserRouter useTransitions={false} basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
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
            path="/library/add"
            element={
              <RequireReader>
                <AddBookPage />
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
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route
            path="/report/:handle"
            element={
              <RequireReader>
                <ReportPage />
              </RequireReader>
            }
          />
          <Route
            path="/fellowship"
            element={
              <RequireReader>
                <FellowshipPage />
              </RequireReader>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireReader>
                <ProfilePage />
              </RequireReader>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <RequireReader>
                <EditProfilePage />
              </RequireReader>
            }
          />
          <Route
            path="/readers/:handle"
            element={
              <RequireReader>
                <ProfilePage />
              </RequireReader>
            }
          />
          <Route
            path="/quests"
            element={
              <RequireReader>
                <QuestsPage />
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
