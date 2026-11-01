# Roadmap

Tomekeeper is built in six stages. Each stage is split into steps small enough to finish, test and review in one sitting.

## Stage 1: Foundation (done)

| Step | What | Status |
| --- | --- | --- |
| 1.1 | Front-end foundation: Vite + React + TypeScript, design tokens (light, dark, paper plates), self-hosted fonts, site shell (header with Dark theme and Plain script, vine strip, footer with credits), framed panels, woodcut drop caps, tests, CI | Done |
| 1.2 | Back-end skeleton: ASP.NET Core (.NET 10) API with health checks (`/api/health/live`, `/api/health/ready` with the database), PostgreSQL 18 in Docker Compose, Entity Framework Core (the first tables and migration come with accounts in 1.3), xUnit v3 tests with Testcontainers, CI, the front-end reaches the API through the Vite proxy | Done |
| 1.3a | Accounts API: sign up, confirm email, sign in and out, forgot and reset password, lockout after 5 tries. Passwords of 15 to 256 characters, checked against common passwords, patterns, the reader's name and email, and Pwned Passwords. Cookie sign-in, a custom request header against cross-site requests, errors per field. The first EF Core migration, with snake_case tables. Emails go to the log in development | Done |
| 1.3b | Front-end accounts: React Router, sign-in and sign-up pages from the 2c design with an error summary, confirm-email, forgot and reset password pages, the header shows the menu and Sign out when signed in, focus moves to the new page after a link, tests with a fake API | Done |
| 1.4a | First steps after sign-up: what the goal counts (pages, books or both), how much (a suggestion of about 20 pages a day to 31 December), and a portrait. `reading_goals` table with one goal per reader and year, `PUT /api/account/portrait`, `GET`/`PUT /api/goals/{year}`. New readers are sent to the first steps until they are done; the chronicle shows the portrait and goal | Done |
| 1.4b | Google sign-in, server side with ASP.NET Core's Google handler (no Google script in the page): "Sign in with Google" and "Sign up with Google" following Google's branding rules, accounts linked by Google's id, linking to an existing account only when its email is confirmed, only the openid, email and profile scopes, no Google photo. The button only shows when the API has a Google client set up | Done |
| 1.5 | Hardening: rate limits per IP address on the account endpoints (429 with Retry-After) and at most 3 emails of one kind per address an hour; security headers on API answers; a Content Security Policy in the production build (the theme script moved to a file); a settings page where readers delete their account, confirmed with their email address and password | Done |

## Stage 2: Library

| Step | What | Status |
| --- | --- | --- |
| 2.1 | Find books: an Open Library client (User-Agent, under 3 calls a second, searches remembered for 10 minutes), the `books` table as Tomekeeper's own catalogue, `GET /api/books/search`, `POST /api/books/open-library/{key}`, `GET /api/books/{id}`, and the Library page with "Find a book" from the 2c design | Done |
| 2.2 | Shelves: Reading now, Want to read, Finished and Set aside; adding a book from the search results (which saves it in the catalogue); "Your shelves" on the Library page | Next |
| 2.3 | The book page: details, the reader's shelf and page count, covers | |
| 2.4 | Adding a book by hand, for books Open Library doesn't have | |

## Later stages

3. **Progress and goals:** log by page or percent, the yearly goal, the Chronicle dashboard and the Twelve Labours (wheel on wide screens, month boxes on phones).
4. **The game:** XP and levels, quests, attributes, gear, volumes.
5. **Fellowship:** profiles with "see your profile as", friends, reviews, block and report. Private by default.
6. **Azure test month and showcase:** infrastructure as code (Bicep), a deploy workflow (with forwarded headers, so Google's redirect address uses https behind Azure), one month on Azure to prove it works end to end, privacy policy and accessibility statement, WCAG audit, README with screenshots, then the deployment comes down again.
