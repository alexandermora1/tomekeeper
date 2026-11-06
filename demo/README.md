# The demo

A version of Tomekeeper that anyone can look around in without an account: the real front-end, signed in as an example reader, Alex, with the data from the design sketches. It runs in the browser on recorded data, so it needs no server and can stay online for free after the Azure month.

Building it has three parts:

1. **The example data** (this folder): readers made through the real API, in a database of their own.
2. **The recording and the demo build** (next step): what the API answers on every page, saved with the front-end.
3. **Hosting** (after that): GitHub Pages.

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
