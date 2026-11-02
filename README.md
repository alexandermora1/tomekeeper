# Tomekeeper

A reading tracker where the yearly goal counts **pages**, not just books. You log progress as you read, earn XP for every page, take on quests through the year and keep a chronicle of what you have read. The look is a late-medieval printed book: woodcuts from the Nuremberg Chronicle (1493), Hans Holbein's initials and a wheel of the twelve labours of the months.

> **Status:** early development. Stage 1, the foundation, is done: the design with light and dark themes and Plain script, the API and database, accounts (email and password, or Google) with email confirmation and password reset, the first steps after signing up (a goal for the year and a portrait), and hardening (rate limits, security headers, a Content Security Policy, deleting an account). Stage 2, the library, is done: readers search Open Library or add books by hand, keep them on four shelves and open a page for each book. Stage 3, progress and goals, has begun: readers log their progress on each book's page. See the [roadmap](docs/roadmap.md).

## What it will do

- Set a yearly goal in pages, books or both, and log progress as you read: page number, or percent for ebooks and audiobooks.
- Earn XP for every page and a bonus for finishing a book. Levels reset each year, and each year is kept as a bound "volume".
- Fixed quests through the year (for example "finish a book over 1,000 pages") that earn cosmetic gear for your reader.
- A library with book data from [Open Library](https://openlibrary.org), shelves, reviews and friends.
- Private by default, accessible (WCAG 2.2 AA), with light and dark themes and a "Plain script" setting that swaps the blackletter for a plain typeface.

## Tech

| Part | Choice |
| --- | --- |
| Front-end | React 19, TypeScript, Vite, React Router, CSS modules |
| Back-end | ASP.NET Core on .NET 10 (minimal API), Entity Framework Core with snake_case tables, ASP.NET Core Identity with email and password or Google |
| Database | PostgreSQL 18 (Docker Compose locally) |
| Tests | Vitest and Testing Library for the front-end; xUnit v3 with Testcontainers for the API |
| CI | GitHub Actions, one workflow for the front-end and one for the API |

## Run it locally

You need:

- **Node.js 24** (it comes with npm 11; older npm versions can fail on the test packages)
- **.NET 10 SDK**
- **Docker Desktop**, running

Then, from the repo root, in three steps:

```sh
# 1. The database (PostgreSQL in Docker)
docker compose up -d

# 2. The API on http://localhost:5080
dotnet run --project api/Tomekeeper.Api

# 3. The front-end on http://localhost:5173, in a second terminal
cd web
npm install
npm run dev
```

Open http://localhost:5173 and create an account. The front-end forwards everything under `/api` to the API, so the two act as one site and the sign-in cookie just works. http://localhost:5173/api/health/ready should answer `{"status":"Healthy",...}` once all three run. If the API isn't running, the forms say "Something went wrong on our side".

Stop the database with `docker compose down`. Your data stays in a Docker volume; `docker compose down -v` deletes it.

### Google sign-in (optional)

Without this, the site works with email and password only, and the Google button doesn't show. To try "Sign in with Google" locally:

1. Open the [Google Cloud console](https://console.cloud.google.com/), sign in and create a project called Tomekeeper.
2. Open **Google Auth Platform** and press **Get started**. App name: Tomekeeper. Audience: **External**. Add your own email where it asks for one.
3. Under **Audience**, leave the app in **Testing** and add your own Google account as a test user. Only test users can sign in while it is in testing.
4. Under **Clients**, create a client of the type **Web application**. Add `http://localhost:5173/api/account/google/callback` under **Authorized redirect URIs**. Copy the client ID and the client secret.
5. Store them for the API with .NET's secret manager, which keeps them outside the repository (from the repo root):

   ```sh
   dotnet user-secrets set "Authentication:Google:ClientId" "<client id>" --project api/Tomekeeper.Api
   dotnet user-secrets set "Authentication:Google:ClientSecret" "<client secret>" --project api/Tomekeeper.Api
   ```

6. Google's rules say the button must use Google's own "G" logo. Download it from the [Sign in with Google branding guidelines](https://developers.google.com/identity/branding-guidelines) (the PNG "G" logo) and save it as `web/src/assets/brand/google-g.png`.
7. Restart the API. The sign-in and sign-up pages now show the Google button.

The button is a plain link to the API, which sends the reader to Google's own sign-in page. No Google script runs on Tomekeeper's pages. Google is asked only for the reader's name and email address (the `openid`, `profile` and `email` scopes).

In development the API creates and updates the tables itself when it starts. It doesn't send real emails yet: the confirmation and password-reset emails are written to the API's log in the terminal. The links in them open the pages on http://localhost:5173, so you can copy a link from the terminal into the browser.

## Books and the Library

The Library page (`/library`) searches [Open Library](https://openlibrary.org) through the API. The search is part of the address (`/library?q=dune`), so the back button and links keep it. Books are shown with a small woodcut title page: the gold initial of the title under a coloured band.

| Request (under `/api/books`) | What it does |
| --- | --- |
| `GET search?q=…` | Searches Open Library and returns the first 20 works, with title, authors, first year, a typical page count and whether the book is already in Tomekeeper's catalogue |
| `POST open-library/{key}` | Saves an Open Library work (such as `OL27448W`) in Tomekeeper's own `books` table, or finds it there. The details are fetched from Open Library again, never taken from the request, because the catalogue is shared |
| `GET {id}` | A book from the catalogue |

Following [Open Library's rules for apps](https://openlibrary.org/developers/api), the API says who it is in the `User-Agent` header, keeps all its calls under 3 a second, and remembers each search for 10 minutes instead of asking again. Searching needs a signed-in reader and is limited to 30 a minute per IP address. If Open Library is down, the page says so.

Settings (in appsettings, or with `dotnet user-secrets` as for Google):

- `OpenLibrary:ContactEmail`: Open Library asks apps for a contact address, and gives identified apps a higher limit. It is added to the `User-Agent` header.
- `OpenLibrary:BaseUrl`: where Open Library is (`https://openlibrary.org/` by default). Tests and offline work can point it at a stand-in.
- `OpenLibrary:CoversUrl`: where Open Library keeps cover images (`https://covers.openlibrary.org/` by default).

### Covers

Covers come through Tomekeeper's own API (`GET /api/covers/{coverId}?size=m` or `size=l`), not straight from Open Library, so readers' browsers never contact anyone else and the Content Security Policy stays at `'self'`. The API fetches each cover once and keeps it in memory (up to 64 MB, least used first out); browsers may keep a cover for a year, since a cover id always shows the same picture. Books without a cover, or whose cover doesn't load, get the woodcut title page instead.

### Shelves

Every reader has four shelves: **Reading now**, **Want to read**, **Finished** and **Set aside**. A book is on one of them at a time. Each search result has a shelf list and an **Add** button; the first time anyone shelves a book, it is saved in the catalogue. Below the search, **Your shelves** lists the reader's books, latest first, with the same list to move a book and a **Remove** button. Long shelves show 12 books until the reader asks for all.

The shelf list changes nothing by itself: the reader chooses, then presses the button, so moving through the list with the arrow keys is safe. When a book moves to another shelf, the focus follows it there; when it is removed, the focus goes to the heading of its shelf. Screen readers hear each change ("Dune is on your Finished shelf.").

| Request (under `/api/shelves`) | What it does |
| --- | --- |
| `GET /` | Every book on the reader's shelves, latest first |
| `PUT {bookId}` with `{ "shelf": "wantToRead" }` | Puts a book from the catalogue on a shelf (`reading`, `wantToRead`, `finished` or `setAside`), or moves it there. Sending the same shelf again changes nothing |
| `DELETE {bookId}` | Takes the book off the reader's shelves. It stays in the catalogue |
| `GET {bookId}` | One book on the reader's shelves, or 404 |
| `PUT {bookId}/page-count` with `{ "pageCount": 512 }` | The page count of the reader's own edition (1 to 20,000), or `null` to use the book's usual count |

### The book page

Each book in the catalogue has a page at `/books/{id}`, linked from its title on the shelves and in search results: the large cover, authors, first year, page count and a link to Open Library, then the reader's shelf with the same shelf list, and the page count of their own edition. Progress (stage 3) will count against that page count.

### Progress

The book page has **Your reading** for books on the reader's shelves: log the page reached, or a percentage for ebooks and audiobooks (turned into a page with the page count). Each entry counts the pages since the one before, on the reader's own date (the browser sends today's date where the reader is, and the API checks that it is today somewhere on Earth), so goals count by the reader's days wherever they live. Logging puts the book on Reading now; the last page, the **I've finished it** button, or moving the book to Finished finishes it, and the rest of its pages count that day. Logging a page in a finished book starts a new reading, so re-reads count too. **Undo the last entry** takes the latest one back. Taking a book off the shelves deletes its progress, so the Remove button asks first when pages are logged.

| Request (under `/api/shelves/{bookId}/progress`) | What it does |
| --- | --- |
| `GET /` | The latest reading, its entries, earlier readings, and the book on the shelves |
| `POST /` with `{ "page": 120, "readOn": "2026-11-02" }` or `{ "percent": 45, … }` | Logs the page reached. It must be later than the last one and within the page count |
| `POST finish` with `{ "readOn": … }` | Finishes the reading in progress |
| `DELETE latest` | Takes back the latest entry |

Tables: `readings` (one time through a book: started and finished dates and the page reached; at most one in progress per book, kept by a partial unique index) and `progress_entries` (date, page reached and pages read). Both go with the book's shelf entry.

### Books added by hand

For books Open Library doesn't have, `/library/add` (linked under the search) takes a title, subtitle, authors (separated by commas), the year and the page count, and a shelf. `POST /api/books` saves the book and puts it on that shelf in one go. These books belong to the reader who added them (`books.added_by_id`): nobody else can see or shelve them, removing one from the shelves deletes it (the button says **Delete**), and they go with the account. The shelf entries point to books with `ON DELETE NO ACTION`, which PostgreSQL checks at the end of the statement, so deleting an account can remove the reader's shelf entries and their own books together.

The `shelf_entries` table has one row per reader and book, so a book can't be on two shelves. Search results say which shelf each book is on, if any. Shelves belong to the reader alone (profiles come in stage 5), go with the account when it is deleted, and hold at most 10,000 books, so one account can't fill the database.

## Accounts and security

The pages:

| Page | What it is |
| --- | --- |
| `/sign-in`, `/sign-up` | Sign in, or create an account. Visitors who aren't signed in are sent here, and back to where they were afterwards |
| `/confirm-email` | Opened from the confirmation email. The reader presses a button to confirm, so email services that open links to scan them don't confirm by accident |
| `/forgot-password`, `/reset-password` | Ask for a reset link, then choose a new password from the link in the email |
| `/first-steps` | Right after signing up: what the goal counts (pages, books or both), how much, and a portrait. New readers are sent here until they have done it |
| `/` | The chronicle, for signed-in readers. It shows the reader's portrait and goal, and reminds readers to confirm their email until they have |
| `/settings` | The account: name, email, whether it has a password, and deleting the account |

The forms follow the [GOV.UK error pattern](https://design-system.service.gov.uk/components/error-summary/): after a failed submit, a summary at the top lists every problem and takes the focus, each problem links to its field, and the message also sits next to the field. The messages come from the API, so the rules live in one place. Fields have `autocomplete` values that password managers understand, and the password can be shown while typing. After moving to another page, focus goes to the main content, so screen readers announce the new page.

The accounts API is under `/api/account`:

| Request | What it does |
| --- | --- |
| `POST register` | Creates an account, signs the reader in and sends an email to confirm the address |
| `POST sign-in`, `POST sign-out` | Signs in with email and password, or out |
| `GET me` | The signed-in reader, or 401 |
| `POST confirm-email`, `POST resend-confirmation` | Confirms the address with the code from the email, or sends a new one |
| `POST forgot-password`, `POST reset-password` | Sends a reset link (the answer is the same whether the account exists or not), then sets a new password |
| `PUT portrait` | Chooses the reader's portrait: `astrologer`, `knight` or `emperor` |
| `GET sign-in-options` | Whether Google sign-in is set up, so the front-end knows whether to show the button |
| `GET google/start`, `GET google/done` | Sends the reader to Google, and signs them in when Google sends them back (through `google/callback`) |
| `POST delete` | Deletes the account and everything in it, after the reader types their email address (and password, if they have one), then sends a last email |

Goals are under `/api/goals/{year}`: `GET` gives the signed-in reader's goal for that year (404 if there is none) and `PUT` sets or changes it, with `kind` (`pages`, `books` or `both`) and the numbers. The year is part of the address because a reader's new year starts at their own midnight; the API accepts last year, this year and next year.

How it is kept safe:

- **Passwords** follow [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html): at least 15 characters, at most 256, any characters allowed, no rules like "one capital letter". A password is refused if it is on a list of about 49,000 common passwords, is a common password with digits or symbols around it, repeats itself, follows the keyboard or the alphabet, or contains the reader's name or email. It is also checked against [Pwned Passwords](https://haveibeenpwned.com/Passwords): only the first 5 characters of its SHA-1 hash leave the server, and if the service can't be reached the check is skipped rather than blocking sign-up. Passwords are stored as hashes by ASP.NET Core Identity.
- **Google sign-in** links a Google account to a Tomekeeper account by Google's own id, which never changes. If an account already has the same email address, Google is only linked when that address has been confirmed: otherwise someone could sign up with another person's address and wait for the owner to arrive with Google. A Google account without a verified email can't be used. New Google readers have no password; "Forgot your password?" can add one.
- **Sign-in** uses an HttpOnly cookie (`SameSite=Lax`, and `Secure` outside development). After 5 wrong passwords the account is locked for 15 minutes. A wrong password and an unknown email get the same answer, so the API doesn't reveal who has an account.
- **Rate limits:** from one IP address, at most 10 requests a minute to sign in, sign up, confirm or reset, and 5 requests per 15 minutes that send an email. On top of that, at most 3 emails of one kind go to one address an hour, however many places ask, so the forms can't be used to flood someone's inbox. Too many requests get `429 Too Many Requests` with a `Retry-After` header and a message the forms show. The numbers are settings (`RateLimits` in appsettings). Locally, every request comes through the Vite proxy, so they all count as one address.
- **Deleting an account** removes it and everything in it (goals, Google link, tokens) at once, through the database's cascade delete. The reader must type their email address, and their password if they have one; wrong passwords there count towards the lockout.
- **Security headers** on every API answer: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and a `Permissions-Policy` that turns off camera, microphone and location.
- **Content Security Policy for the pages:** the production build adds a policy that only lets the browser run scripts and load styles, fonts and images from Tomekeeper itself, so injected code has nothing to run or send to. That is why the small script that sets the theme before the first paint is a file (`web/public/theme.js`) and not inline. The development server runs without it, because hot reloading needs inline code. To try the built site: `npm run build`, then `npx vite preview` (it forwards `/api` like the dev server) and open http://localhost:4173.
- **Cross-site requests:** every request that changes something must carry the header `X-Tomekeeper-Request`. A form on another site can't add that header, so it can't act on a reader's behalf (the [custom request header](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi) defence).
- **Errors** come back as [problem details](https://www.rfc-editor.org/rfc/rfc9457) with messages per field (`displayName`, `email`, `password`), written so the front-end can show them as they are.

To try it with curl while the API runs:

```sh
curl -i -c cookies.txt -H "Content-Type: application/json" -H "X-Tomekeeper-Request: 1" \
  -d '{"displayName":"Alex","email":"alex@example.no","password":"lantern harbour winter quill"}' \
  http://localhost:5080/api/account/register

curl -b cookies.txt http://localhost:5080/api/account/me
```

## Tests

```sh
# Front-end, from web/ (no API needed: the tests use a fake one in src/test/fakeApi.ts)
npm test             # once
npm run test:watch   # on every change
npm run typecheck

# API, from the repo root (Docker Desktop must be running)
dotnet test
```

The API tests start the real API in memory and their own PostgreSQL in Docker with [Testcontainers](https://dotnet.testcontainers.org), so they never touch your development database. To use a PostgreSQL server you already have instead, set `TOMEKEEPER_TEST_POSTGRES` to a connection string for a user that may create databases; the tests then create and drop their own database on it.

## Project layout

```
tomekeeper/
├── api/
│   ├── Tomekeeper.Api/         the API, set up in Program.cs
│   │   ├── Accounts/           sign-up, sign-in, emails, portraits, error messages
│   │   ├── Goals/              the reader's goal for each year
│   │   ├── Books/              the book catalogue and the Open Library client
│   │   ├── Passwords/          password rules, common password list, breach check
│   │   ├── Security/           the request header check
│   │   ├── Data/               EF Core database context and migrations
│   │   └── Health/             health checks
│   └── Tomekeeper.Api.Tests/   xUnit tests
├── web/                        front-end (React + TypeScript + Vite)
│   ├── src/api/                calls to the API, with the request header and error handling
│   ├── src/session/            who is signed in, and the guards that send visitors to sign in
│   ├── src/routing/            focus and page titles when moving between pages
│   ├── src/components/         shared parts: header, frame, drop cap, footer, buttons
│   ├── src/components/forms/   text and password fields, radio groups, error summary
│   ├── src/goals/              goal text and the suggested first goal
│   ├── src/pages/              one file per page, with its tests beside it
│   ├── src/test/               test setup, a fake API for the tests
│   ├── src/styles/             design tokens (light, dark, paper) and base styles
│   ├── src/theme/              Dark theme and Plain script preferences
│   ├── src/woodcuts/           the woodcut initials (J uses I, U uses V)
│   └── src/assets/             woodcut images
├── docs/                       roadmap, design tokens, image credits
├── docker-compose.yml          local PostgreSQL
├── Tomekeeper.slnx             the .NET solution
├── Directory.Build.props       shared C# settings (.NET 10, nullable, warnings as errors)
├── Directory.Packages.props    all NuGet package versions in one place
└── .github/workflows/          CI
```

## Accessibility

The site aims for WCAG 2.2 AA. Every colour pair is checked for contrast (see [docs/design-tokens.md](docs/design-tokens.md)), the decorative typeface can be turned off, the theme follows the device setting unless the reader picks one, and the tests find elements by role and name, the same way assistive technology does.

## How it is built

The first version is written with Claude (an AI assistant) from my design decisions, in small steps that I review. Afterwards I rebuild it by hand as a course for myself, using this version as the answer key.

## Credits

All images are in the public domain. Details are in [docs/image-credits.md](docs/image-credits.md). Fonts: [Grenze Gotisch](https://fonts.google.com/specimen/Grenze+Gotisch), [Alegreya and Alegreya SC](https://www.huertatipografica.com/en/fonts/alegreya-ht-pro), all under the SIL Open Font License and self-hosted.

The "Sign in with Google" button uses [Google Sans](https://fonts.google.com/specimen/Google+Sans) (SIL Open Font License, self-hosted) and Google's "G" logo, as [Google's branding guidelines](https://developers.google.com/identity/branding-guidelines) require.

Book data comes from [Open Library](https://openlibrary.org), the open catalogue of the Internet Archive.

The common password list comes from [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) (MIT licence, see `api/Tomekeeper.Api/Passwords/common-passwords.LICENSE.txt`). The breach check uses the free [Pwned Passwords](https://haveibeenpwned.com/Passwords) API by Troy Hunt.
