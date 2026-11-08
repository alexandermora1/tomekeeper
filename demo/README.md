# The demo

A version of Tomekeeper that anyone can look around in without an account: the real front-end, signed in as an example reader, Alex, with the data from the design sketches. It runs in the browser on recorded data, so it needs no server and can stay online for free after the Azure month.

Building it has three parts:

1. **The example data** (this folder): readers made through the real API, in a database of their own.
2. **The recording and the demo build**: what the API answers on every page, saved with the front-end in `web/src/demo/recording.json`, and a build that answers from it.
3. **Hosting** (next step): GitHub Pages.

## The example readers

- **Alex**, after the sketches: 13 books finished this year towards an 8,000-page goal, *Memories of Ice* and *The Dawn of Everything* on the go, *Gödel, Escher, Bach* set aside, nine books waiting, seven reviews, and the 2024 and 2025 volumes behind him.
- **Jonas, Ingrid, Marius and Sofie**, his friends, each with a year of their own and some reviews of the same books.
- **Henrik**, who has asked Alex to be friends, and **Eirik**, whom Alex has asked.

The books are in [catalogue.json](catalogue.json): real titles, authors and years, with usual page counts. They are served by a stand-in for Open Library ([open-library.js](open-library.js)) with made-up keys and no covers, so every book gets Tomekeeper's woodcut title page.

## Making the data

The API only takes reading dates near today, so [seed.mjs](seed.mjs) does everything through the API today, then moves the dates back in one SQL file (`out/shift-dates.sql`, not in git). Today's date in the demo is the day it was made.

```sh
# 1. The stand-in Open Library, on port 5099.
node demo/open-library.js

# 2. In another terminal: the API on a database of its own, with the rate limits raised for seeding.
#    In development the API creates the database when it starts.
ConnectionStrings__Tomekeeper="Host=localhost;Port=5432;Database=tomekeeper_demo;Username=tomekeeper;Password=tomekeeper_dev" \
OpenLibrary__BaseUrl=http://localhost:5099/ OpenLibrary__CoversUrl=http://localhost:5099/ \
RateLimits__AccountRequestsPerMinute=1000 RateLimits__SearchRequestsPerMinute=10000 \
dotnet run --project api/Tomekeeper.Api

# 3. In a third: make the readers. Without psql on the Mac, run it in the database's container.
DEMO_PSQL="docker compose exec -T db psql -U tomekeeper -d tomekeeper_demo" node demo/seed.mjs
```

It takes about 20 seconds. To start again, drop the database (`docker compose exec db dropdb -U tomekeeper tomekeeper_demo`) and restart the API. Every demo reader's password is `lantern harbour winter quill`, and their emails end in `@demo.tomekeeper.invalid`, so you can sign in as Alex to look around before recording.

## Recording

With the same API still running on the demo database, and the stand-in Open Library (for search):

```sh
node demo/record.mjs
```

[record.mjs](record.mjs) signs in as Alex and saves what the API answers to every request the pages make (the chronicle, quests, character, legacy, shelves, every book page, every profile, the fellowship, the settings) in `web/src/demo/recording.json`, about 140 KB. It also saves the whole catalogue as search results and the other readers as reader cards, so the demo can answer searches. The demo's today is the day of the recording.

## The demo build

```sh
cd web
npm run build:demo      # into web/dist-demo, for serving under /tomekeeper/
npx vite preview --outDir dist-demo --base /tomekeeper/   # to try it: http://localhost:4173/tomekeeper/
```

It is the ordinary front-end built in the mode `demo`, which sets `VITE_DEMO` to `true` ([vite.config.ts](../web/vite.config.ts)), and the code in [web/src/demo](../web/src/demo):

- `apiRequest` answers from the recording instead of the network ([demoApi.ts](../web/src/demo/demoApi.ts)). Book and reader searches look through the recorded catalogue and readers, without accents ("godel" finds Gödel). Anything that would change data is refused with "This is a demo, so nothing is saved", which the pages show where they show errors.
- The clock stands still at noon on the recorded day ([clock.ts](../web/src/demo/clock.ts)), so this month, this year and "pages a day from today" match the data however long the demo stays online.
- A banner above every page says it is a demo with example data, on which day, and that nothing is saved. There is no Sign out, the Open Library links are searches (the demo's keys are made up), and the privacy page says what the demo itself keeps: nothing.
- The router and the addresses on the page work under a folder (`--base /tomekeeper/`).

Other builds leave all of this out: the checks of `VITE_DEMO` are settled when building, so the demo code and the recording aren't in the real site's bundle.
