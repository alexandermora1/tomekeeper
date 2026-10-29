# Roadmap

Tomekeeper is built in six stages. Each stage is split into steps small enough to finish, test and review in one sitting.

## Stage 1: Foundation

| Step | What | Status |
| --- | --- | --- |
| 1.1 | Front-end foundation: Vite + React + TypeScript, design tokens (light, dark, paper plates), self-hosted fonts, site shell (header with Dark theme and Plain script, vine strip, footer with credits), framed panels, woodcut drop caps, tests, CI | Done |
| 1.2 | Back-end skeleton: ASP.NET Core (.NET 10) API with health checks (`/api/health/live`, `/api/health/ready` with the database), PostgreSQL 18 in Docker Compose, Entity Framework Core (the first tables and migration come with accounts in 1.3), xUnit v3 tests with Testcontainers, CI, the front-end reaches the API through the Vite proxy | Done |
| 1.3 | Accounts with email: sign up, confirm email, sign in and out, forgot password. Passwords of at least 15 characters checked against a list of breached and common passwords. Cookie sign-in with antiforgery. The first EF Core migration. Front-end: routing, sign-in and sign-up pages with an error summary | Next |
| 1.4 | Google sign-in and first steps after sign-up: choose a goal (pages, books or both) and a portrait | |
| 1.5 | Hardening: rate limiting on sign-in, security headers, account deletion, README update | |

## Later stages

2. **Library:** search Open Library, keep books in our own catalogue, shelves (Reading now, Want to read, Finished, Set aside), add a book by hand.
3. **Progress and goals:** log by page or percent, the yearly goal, the Chronicle dashboard and the Twelve Labours (wheel on wide screens, month boxes on phones).
4. **The game:** XP and levels, quests, attributes, gear, volumes.
5. **Fellowship:** profiles with "see your profile as", friends, reviews, block and report. Private by default.
6. **Azure test month and showcase:** infrastructure as code (Bicep), a deploy workflow, one month on Azure to prove it works end to end, privacy policy and accessibility statement, WCAG audit, README with screenshots, then the deployment comes down again.
