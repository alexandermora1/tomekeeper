import { Link } from 'react-router';
import { useSite } from '../api/site';
import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import styles from './StatementPage.module.css';

const UPDATED = '4 November 2026';

/** The privacy policy. Address: /privacy, open to everyone. */
export function PrivacyPage() {
  usePageTitle('Privacy');
  const site = useSite();
  const contact = site?.contactEmail ? <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> : null;

  return (
    <Layout current={null}>
      <article className={styles.page}>
        <h1 className={styles.title}>Privacy</h1>
        <p className={styles.updated}>Last changed {UPDATED}.</p>

        <section className={styles.short} aria-labelledby="privacy-short">
          <h2 id="privacy-short">In short</h2>
          <ul>
            <li>Tomekeeper keeps only what it needs to track your reading: your account, your books and your progress.</li>
            <li>No adverts, no analytics and no tracking. The only cookie is the one that keeps you signed in.</li>
            <li>Your reading is shown to your friends at most, until you choose to share it with everyone.</li>
            <li>You can delete your account in Settings at any time, and everything you added goes with it.</li>
          </ul>
        </section>

        <h2>Who is responsible</h2>
        {site?.operatorName ? (
          <p>
            Tomekeeper is a personal portfolio project run by {site.operatorName}, who is responsible for your data
            (the data controller). It is not a company.
          </p>
        ) : (
          <p>
            Tomekeeper is a personal portfolio project, not a company. When the site is online, the name of the person who
            runs it and is responsible for your data (the data controller) is shown here.
          </p>
        )}
        <p>Questions about your data: {contact ?? 'the contact address is shown here when the site is online'}.</p>
        <p>
          Tomekeeper is online for a test period. When the test ends, the whole site is taken down and all data in it is
          deleted.
        </p>

        <h2>What Tomekeeper keeps, and why</h2>
        <h3>Your account</h3>
        <ul>
          <li>Your name on the site, your email address and the portrait you choose.</li>
          <li>
            Your password, kept only as a one-way hash that can't be turned back into the password. If you sign in with
            Google, Tomekeeper keeps Google's id for your account instead, and gets your name and email from Google.
          </li>
          <li>When the account was made, whether your email is confirmed, and failed sign-ins (to lock out guessing).</li>
        </ul>
        <p>This is needed to give you an account and keep it safe.</p>

        <h3>Your reading</h3>
        <ul>
          <li>The books on your shelves, books you add by hand, your edition's page count, and fiction or nonfiction.</li>
          <li>The pages you log and the dates you give, your yearly goal, and what the game works out from them: XP, levels, quests and gear.</li>
          <li>Your reviews: stars and words.</li>
        </ul>
        <p>This is what Tomekeeper is for: keeping your reading chronicle.</p>

        <h3>Your profile and fellowship</h3>
        <ul>
          <li>Your address on the site, the text about you, and who may see each part of your profile.</li>
          <li>Your friends, requests you have sent or received, and readers you have blocked.</li>
        </ul>

        <h3>Reports</h3>
        <p>
          If you report a reader or a review, Tomekeeper keeps the report, what you wrote, and a copy of what you
          reported as it was then. It is emailed to the person who runs the site, who reads it to decide what to do. The
          reported reader isn't told. A report is deleted when either account is deleted.
        </p>

        <h3>Technical data</h3>
        <ul>
          <li>
            To stop people from guessing passwords or flooding the site, Tomekeeper counts requests from each internet
            address for a few minutes. These counts are kept in memory only, never saved.
          </li>
          <li>
            The site keeps a log of its own events and errors, to find faults. It doesn't record internet addresses, and it
            is kept for 3 days. Microsoft, which hosts the site, also handles technical data such as internet addresses
            to run and protect its service.
          </li>
        </ul>

        <h2>Cookies and storage on your device</h2>
        <ul>
          <li>
            <strong>tomekeeper.auth</strong>: keeps you signed in. It lasts 14 days from your last visit and can't be read
            by scripts on the page. It is needed for the site to work, so it doesn't need your consent.
          </li>
          <li>When you sign in with Google, two short-lived cookies carry Google's answer back to Tomekeeper and are then removed.</li>
          <li>
            Your choices of theme and Plain script are kept in your browser's own storage on this device. They never leave
            it.
          </li>
        </ul>

        <h2>Who else handles your data</h2>
        <ul>
          <li>
            <strong>Microsoft Azure</strong> runs the site and the database, in the Norway East region, so your data stays
            in Norway. Emails (confirming your address, password resets, reports) are sent through Azure Communication
            Services, which keeps its data in Europe. Microsoft handles the data for Tomekeeper as a data processor, under
            Microsoft's data protection terms.
          </li>
          <li>
            <strong>Google</strong>, only if you choose to sign in with Google. Google then knows you used your Google
            account to sign in to Tomekeeper.
          </li>
          <li>
            <strong>Have I Been Pwned</strong>: when you choose a password, Tomekeeper checks whether it has appeared in a
            data breach. Only the first 5 characters of the password's hash are sent, which can't tell anyone your password.
          </li>
          <li>
            <strong>Open Library</strong>: when you search for books, Tomekeeper sends your search words to Open Library and
            fetches covers from it. Nothing about you is sent, and your browser never contacts Open Library itself.
          </li>
        </ul>
        <p>Tomekeeper never sells or shares your data for advertising.</p>

        <h2>Who can see what</h2>
        <p>
          Only signed-in readers can see profiles. Your name, portrait and the text about you are always shown, so friends
          can find you. Everything else (your year and volumes, Reading now, reviews and friends) starts as visible to your
          friends only. You can change each part on <Link to="/profile">your profile</Link>, to everyone or only you.
          Readers you block see nothing of you.
        </p>

        <h2>How long it is kept</h2>
        <p>
          Everything is kept until you delete your account, and deleted with it: your shelves, books you added by hand,
          progress, reviews, profile, friendships, blocks and reports. The database's backups are kept for 7 days, so
          deleted data is gone from them within a week. The site's log is kept for 3 days.
        </p>

        <h2>The legal basis</h2>
        <p>
          Tomekeeper uses your data to give you the service you signed up for (the GDPR's article 6(1)(b), a contract),
          and to keep the site safe and handle reports (article 6(1)(f), legitimate interests).
        </p>

        <h2>Your rights</h2>
        <ul>
          <li>See what Tomekeeper keeps about you, and get a copy: write to the contact address above.</li>
          <li>Correct it: most of it you can change yourself on your profile, your book pages and in Settings.</li>
          <li>
            Delete it: delete your account in <Link to="/settings">Settings</Link>.
          </li>
          <li>Object to how your data is used, or ask for it to be used less: write to the contact address.</li>
        </ul>
        <p>
          You can also complain to the Norwegian Data Protection Authority,{' '}
          <a href="https://www.datatilsynet.no/en/">Datatilsynet</a>.
        </p>

        <h2>Children</h2>
        <p>Tomekeeper is not meant for children under 13.</p>

        <h2>Changes</h2>
        <p>If this policy changes, the new version is shown here with the date it changed.</p>
      </article>
    </Layout>
  );
}
