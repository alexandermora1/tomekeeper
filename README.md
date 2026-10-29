# Tomekeeper

A reading tracker where the yearly goal counts **pages**, not just books. You log progress as you read, earn XP for every page, take on quests through the year and keep a chronicle of what you have read. The look is a late-medieval printed book: woodcuts from the Nuremberg Chronicle (1493), Hans Holbein's initials and a wheel of the twelve labours of the months.

> **Status:** early development. Stage 1, steps 1.1 and 1.2 are done: the front-end foundation (design, light and dark themes, Plain script) and the back-end skeleton (API, database, tests). See the [roadmap](docs/roadmap.md).

## What it will do

- Set a yearly goal in pages, books or both, and log progress as you read: page number, or percent for ebooks and audiobooks.
- Earn XP for every page and a bonus for finishing a book. Levels reset each year, and each year is kept as a bound "volume".
- Fixed quests through the year (for example "finish a book over 1,000 pages") that earn cosmetic gear for your reader.
- A library with book data from [Open Library](https://openlibrary.org), shelves, reviews and friends.
- Private by default, accessible (WCAG 2.2 AA), with light and dark themes and a "Plain script" setting that swaps the blackletter for a plain typeface.

## Tech

| Part | Choice |
| --- | --- |
| Front-end | React 19, TypeScript, Vite, CSS modules |
| Back-end | ASP.NET Core on .NET 10 (minimal API), Entity Framework Core; ASP.NET Core Identity for email and Google sign-in from step 1.3 |
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

The front-end forwards everything under `/api` to the API, so http://localhost:5173/api/health/ready should answer `{"status":"Healthy",...}` once all three run.

Stop the database with `docker compose down`. Your data stays in a Docker volume; `docker compose down -v` deletes it.

## Tests

```sh
# Front-end, from web/
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
│   ├── Tomekeeper.Api/         the API: Program.cs, Data/ (EF Core), Health/
│   └── Tomekeeper.Api.Tests/   xUnit tests
├── web/                        front-end (React + TypeScript + Vite)
│   ├── src/components/         shared parts: header, frame, drop cap, footer
│   ├── src/pages/              one file per page
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

## Image credits

All images are in the public domain. Details are in [docs/image-credits.md](docs/image-credits.md). Fonts: [Grenze Gotisch](https://fonts.google.com/specimen/Grenze+Gotisch), [Alegreya and Alegreya SC](https://www.huertatipografica.com/en/fonts/alegreya-ht-pro), all under the SIL Open Font License and self-hosted.
