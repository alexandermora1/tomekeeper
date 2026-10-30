# Tomekeeper

A reading tracker where the yearly goal counts **pages**, not just books. You log progress as you read, earn XP for every page, take on quests through the year and keep a chronicle of what you have read. The look is a late-medieval printed book: woodcuts from the Nuremberg Chronicle (1493), Hans Holbein's initials and a wheel of the twelve labours of the months.

> **Status:** early development. In stage 1, the front-end foundation (design, light and dark themes, Plain script), the back-end skeleton (API, database, tests) and accounts with email (sign-up, sign-in, email confirmation and password reset, in the API and as pages) are done. Google sign-in and choosing a goal and portrait come next. See the [roadmap](docs/roadmap.md).

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
| Back-end | ASP.NET Core on .NET 10 (minimal API), Entity Framework Core with snake_case tables, ASP.NET Core Identity (email accounts now, Google sign-in in step 1.4) |
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

In development the API creates and updates the tables itself when it starts. It doesn't send real emails yet: the confirmation and password-reset emails are written to the API's log in the terminal. The links in them open the pages on http://localhost:5173, so you can copy a link from the terminal into the browser.

## Accounts and security

The pages:

| Page | What it is |
| --- | --- |
| `/sign-in`, `/sign-up` | Sign in, or create an account. Visitors who aren't signed in are sent here, and back to where they were afterwards |
| `/confirm-email` | Opened from the confirmation email. The reader presses a button to confirm, so email services that open links to scan them don't confirm by accident |
| `/forgot-password`, `/reset-password` | Ask for a reset link, then choose a new password from the link in the email |
| `/` | The chronicle, for signed-in readers. It reminds readers to confirm their email until they have |

The forms follow the [GOV.UK error pattern](https://design-system.service.gov.uk/components/error-summary/): after a failed submit, a summary at the top lists every problem and takes the focus, each problem links to its field, and the message also sits next to the field. The messages come from the API, so the rules live in one place. Fields have `autocomplete` values that password managers understand, and the password can be shown while typing. After moving to another page, focus goes to the main content, so screen readers announce the new page.

The accounts API is under `/api/account`:

| Request | What it does |
| --- | --- |
| `POST register` | Creates an account, signs the reader in and sends an email to confirm the address |
| `POST sign-in`, `POST sign-out` | Signs in with email and password, or out |
| `GET me` | The signed-in reader, or 401 |
| `POST confirm-email`, `POST resend-confirmation` | Confirms the address with the code from the email, or sends a new one |
| `POST forgot-password`, `POST reset-password` | Sends a reset link (the answer is the same whether the account exists or not), then sets a new password |

How it is kept safe:

- **Passwords** follow [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html): at least 15 characters, at most 256, any characters allowed, no rules like "one capital letter". A password is refused if it is on a list of about 49,000 common passwords, is a common password with digits or symbols around it, repeats itself, follows the keyboard or the alphabet, or contains the reader's name or email. It is also checked against [Pwned Passwords](https://haveibeenpwned.com/Passwords): only the first 5 characters of its SHA-1 hash leave the server, and if the service can't be reached the check is skipped rather than blocking sign-up. Passwords are stored as hashes by ASP.NET Core Identity.
- **Sign-in** uses an HttpOnly cookie (`SameSite=Lax`, and `Secure` outside development). After 5 wrong passwords the account is locked for 15 minutes. A wrong password and an unknown email get the same answer, so the API doesn't reveal who has an account.
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
│   │   ├── Accounts/           sign-up, sign-in, emails, error messages
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
│   ├── src/components/forms/   text and password fields, error summary
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

The common password list comes from [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) (MIT licence, see `api/Tomekeeper.Api/Passwords/common-passwords.LICENSE.txt`). The breach check uses the free [Pwned Passwords](https://haveibeenpwned.com/Passwords) API by Troy Hunt.
