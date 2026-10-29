# Tomekeeper

A reading tracker where the yearly goal counts **pages**, not just books. You log progress as you read, earn XP for every page, take on quests through the year and keep a chronicle of what you have read. The look is a late-medieval printed book: woodcuts from the Nuremberg Chronicle (1493), Hans Holbein's initials and a wheel of the twelve labours of the months.

> **Status:** early development. Stage 1, step 1.1 is done: the front-end foundation with the design, light and dark themes and the Plain script setting. See the [roadmap](docs/roadmap.md).

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
| Tests (front-end) | Vitest, Testing Library |
| Back-end (from step 1.2) | ASP.NET Core on .NET 10, Entity Framework Core, ASP.NET Core Identity (email and Google sign-in) |
| Database (from step 1.2) | PostgreSQL in Docker |
| Tests (back-end) | xUnit |
| CI | GitHub Actions |

## Run it locally

You need **Node.js 24** (it comes with npm 11; older npm versions can fail on the test packages).

```sh
cd web
npm install
npm run dev        # http://localhost:5173
```

Other commands, all from `web/`:

```sh
npm test           # run the tests once
npm run test:watch # run the tests on every change
npm run typecheck  # TypeScript check without building
npm run build      # production build in web/dist
```

From step 1.2 you will also need the [.NET 10 SDK](https://dotnet.microsoft.com/download) and [Docker Desktop](https://www.docker.com/products/docker-desktop/).

## Project layout

```
tomekeeper/
├── web/                  front-end (React + TypeScript + Vite)
│   ├── src/components/   shared parts: header, frame, drop cap, footer
│   ├── src/pages/        one file per page
│   ├── src/styles/       design tokens (light, dark, paper) and base styles
│   ├── src/theme/        Dark theme and Plain script preferences
│   ├── src/woodcuts/     the woodcut initials (J uses I, U uses V)
│   └── src/assets/       woodcut images
├── docs/                 roadmap, design tokens, image credits
└── .github/workflows/    CI
```

## Accessibility

The site aims for WCAG 2.2 AA. Every colour pair is checked for contrast (see [docs/design-tokens.md](docs/design-tokens.md)), the decorative typeface can be turned off, the theme follows the device setting unless the reader picks one, and the tests find elements by role and name, the same way assistive technology does.

## How it is built

The first version is written with Claude (an AI assistant) from my design decisions, in small steps that I review. Afterwards I rebuild it by hand as a course for myself, using this version as the answer key.

## Image credits

All images are in the public domain. Details are in [docs/image-credits.md](docs/image-credits.md). Fonts: [Grenze Gotisch](https://fonts.google.com/specimen/Grenze+Gotisch), [Alegreya and Alegreya SC](https://www.huertatipografica.com/en/fonts/alegreya-ht-pro), all under the SIL Open Font License and self-hosted.
