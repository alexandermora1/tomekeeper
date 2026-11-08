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
| 2.2 | Shelves: Reading now, Want to read, Finished and Set aside (the `shelf_entries` table, `GET`/`PUT`/`DELETE /api/shelves`); adding a book from the search results (which saves it in the catalogue); "Your shelves" on the Library page, with moving and removing | Done |
| 2.3 | The book page (`/books/{id}`): details, the reader's shelf, the page count of their own edition (`PUT /api/shelves/{bookId}/page-count`); covers through Tomekeeper's own API (`GET /api/covers/{coverId}`), kept in memory, with the woodcut title page as a stand-in | Done |
| 2.4 | Adding a book by hand (`/library/add`, `POST /api/books`), for books Open Library doesn't have. Such books are private to the reader who added them and are deleted when removed from the shelves | Done |

## Stage 3: Progress and goals

| Step | What | Status |
| --- | --- | --- |
| 3.1 | Logging progress on the book page: the page reached or a percentage, on the reader's own date; finishing (last page, "I've finished it", or moving to Finished); reading again; undoing the last entry. `readings` and `progress_entries` tables, `/api/shelves/{bookId}/progress`. Removing a book with logged pages asks first | Done |
| 3.2 | The Chronicle dashboard: the Year's Reckoning (pages and books against the goal, pages a day to reach it) and quick logging for the books on Reading now. `GET /api/chronicle/{year}` | Done |
| 3.3 | The Twelve Labours: pages per month, an SVG wheel with the sun in the hub on wide screens and month boxes on phones (the boxes stay for screen readers on wide screens) | Done |

## Stage 4: The game

Confirmed by Alex on 2 November 2026: the titles by level, the six quests with their gear, gear as medallions around the portrait.

| Step | What | Status |
| --- | --- | --- |
| 4.1 | XP and levels: 1 XP per page, a quarter of a book's pages for finishing it, levels from 25 × (level − 1) × (level + 20) XP, starting again each January; titles Novice (1–4), Reader (5–9), Wayfarer (10–14), Scholar (15–19), Sage (20+). `GET /api/character/{year}`, the Quests page with level and titles, the level on the chronicle | Done |
| 4.2 | Quests and gear: the six yearly quests (The Bookbinder, The Scholar, The Long Road, Five Decades, The Chronicler, The Long Nights), gear kept for good in the `gear` table, medallions around the portrait; fiction or nonfiction from Open Library's subjects, the add form and the reader's own say | Done |
| 4.3 | Attributes (Endurance, Wisdom, Imagination, Wanderlust: a point per 500 pages of each kind, kept across years) and volumes (each year bound when it ends), `GET /api/legacy` | Done |

## Stage 5: Fellowship (done)

Confirmed by Alex on 2 November 2026: reviews with 1 to 5 stars, readers found by profile link and name search, reports stored and emailed to a moderator address, no leaderboard. Private by default.

| Step | What | Status |
| --- | --- | --- |
| 5.1 | Profiles: an address of one's own (`/readers/{handle}`, made from the name, changeable), a short text, who sees what (Everyone, Friends, Only you; Friends to begin with) for the year and volumes, Reading now, reviews and the fellowship, and "See your profile as" | Done |
| 5.2 | Friends: finding readers by name or address, asking to be friends, accepting or ignoring, the Fellowship page; friends see what is shared with friends, and each other's fellowship | Done |
| 5.3 | Reviews with 1 to 5 stars on book pages and profiles; The Chronicler quest counts them | Done |
| 5.4 | Blocking (hidden both ways, undone from the Fellowship page) and reporting a reader or a review (stored with a copy of what was reported, and emailed to `App:ModeratorEmail`) | Done |

## Stage 6: Azure test month and showcase

Decided by Alex on 3 November 2026: one App Service for the site and the API, in Norway East, with Azure Communication Services for email.

| Step | What | Status |
| --- | --- | --- |
| 6.1 | Ready for App Service: the API serves the built front-end with a fallback to `index.html`, forwarded headers behind the proxy, HSTS, migrations on start, kept sign-in keys, email through Azure Communication Services | Done |
| 6.2 | Infrastructure as code (Bicep, `infra/`): App Service (F1, Linux, .NET 10), PostgreSQL Flexible Server (B1ms, PostgreSQL 18), Communication Services with an Azure-managed email domain, a budget alert; the first half of `docs/azure.md` | Done |
| 6.3 | Deploy workflow (GitHub Actions, run by hand, signing in to Azure with OIDC and a role limited to the web app), a Bicep check workflow, the rest of `docs/azure.md` | Done |
| 6.3b | The month on Azure: Alex creates the account and deploys; what to try is in `docs/azure.md` | When Alex is ready |
| 6.4 | Privacy policy (`/privacy`) and accessibility statement (`/accessibility`), with who runs the site from deployment settings (`GET /api/site`); an image credits page (`/credits`) for the footer link | Done |
| 6.5 | WCAG audit against all 55 WCAG 2.2 A and AA criteria (`docs/wcag-audit.md`): an automated sweep of every page in both themes and a code review; one fix (target size) | Done |
| 6.5b | VoiceOver walk-through by Alex (`docs/voiceover-checklist.md`), then the statement and audit updated | When Alex is ready |
| 6.6 | README with screenshots and a recording, then the deployment comes down | |

### The demo

Decided by Alex on 6 November 2026: a demo anyone can look around in, signed in as an example reader with the data from the design sketches, running in the browser on recorded data so it can stay online for free.

| Step | What | Status |
| --- | --- | --- |
| D1 | Example data (`demo/`): the sketches' catalogue, a stand-in Open Library for it, and a script that makes seven readers through the API and moves their dates back | Done |
| D2 | Recording what the API answers on every page (`demo/record.mjs`); a demo build (`npm run build:demo`) that answers from it, with search over the recorded catalogue, a banner, a clock stopped at the recorded day and "nothing is saved" for changes | Done |
| D3 | Hosting on GitHub Pages, with a workflow, and a link from the README | Next |

## Earlier plan for stage 6

6. **Azure test month and showcase:** infrastructure as code (Bicep), a deploy workflow (with forwarded headers, so Google's redirect address uses https behind Azure), one month on Azure to prove it works end to end, privacy policy (including what reports keep, and who reads them) and accessibility statement, WCAG audit, README with screenshots, then the deployment comes down again.
