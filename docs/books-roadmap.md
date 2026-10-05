# Books: ideas for later

Collected on 2026-10-04 while polishing the books feature. Nothing here is built yet. Each section lists what we want, what I found, and a suggested approach.

## 1. Reliable genres

**Today:** `books.genres` is a free-text string array. "Self Help", "self-help" and "Self help" count as three genres, and nothing suggests existing ones when you type.

**Goal:** genres you can trust enough to chart (top genres, genres over time, ratings by genre).

**Suggested approach:**
- Normalize on write: trim, collapse spaces, and compare case-insensitively so duplicates can't be created.
- Autocomplete from the genres you already use (one query over your books) in the panel's tag input.
- A small "Manage genres" view to rename or merge two genres across all books in one mutation.
- When importing from an API (section 4), map its subjects onto your existing genres instead of adding raw subjects. Open Library and Google Books subjects are noisy ("Fiction, general", "Large type books").

**Open question:** keep genres as strings on the book (simple, enough for one user) or move them to a `genres` table with ids (needed only if genres get colors, icons or descriptions). Strings plus normalization are probably enough.

## 2. More book fields

Fields common across book databases, and which source provides them:

| Field | Google Books | Open Library | Hardcover | Goodreads page | Worth adding? |
|---|---|---|---|---|---|
| ISBN-13 / ISBN-10 | yes | yes | yes | yes | Yes: lookup key and dedupe |
| Subtitle | yes | yes | yes | no | Yes |
| Description | yes (HTML) | sometimes | yes | yes | Yes |
| Publisher | yes | yes | yes | yes | Yes |
| Published date / year | yes (edition) | yes (edition) | yes | yes | Yes |
| Original publication year | no | via work | yes | yes | Yes: matters for translations |
| Original title | no | via work | yes | sometimes | Yes: useful for Hungarian translations like "Never Let Me Go (Ne engedj el…)" |
| Language | yes | yes | yes | yes | Yes |
| Page count | yes | yes | yes | yes | Already have |
| Series name and number | no | rarely | yes | yes | Yes |
| Categories / subjects | yes | yes (noisy) | genres, moods | genres (user-voted) | Feed into genres (section 1) |
| Cover image | yes | yes | yes | yes | Already have |
| Average rating | yes | no | yes | yes | Maybe: as context, not your own rating |
| Translator | no | sometimes | yes | sometimes | Maybe |
| External ids (Google volume id, Open Library id, Hardcover id, Goodreads id) | own id | own id | own id | own id | Yes: lets us refresh data later |

**Suggested first batch:** ISBN-13, subtitle, description, publisher, publication year, original publication year, original title, language, series name and number, external ids. Show description and series in the panel header; the rest goes in a collapsible "Edition details" section.

## 3. Reading progress history

**Goal:** know on which days (and later, at which times) you read, for a pages-per-day line chart now and habit statistics later.

**Suggested model:** a new `readingEvents` table. One row per progress change:

| Field | Why |
|---|---|
| `userId`, `bookId` | Ownership and per-book history |
| `pagesRead` | Absolute page after the update |
| `pagesDelta` | Pages added by this update (can be negative after a correction) |
| `at` | Timestamp of the update |
| `timeZone` | IANA zone from the browser (e.g. `Europe/Budapest`), so "hour of day" and "day" stats use local time, not UTC |
| `source` | `progress`, `status` (finishing fills the remaining pages) or `import` |

Indexes: `by_user_and_at` for charts, `by_book_and_at` for a book's own history.

**Rules that keep the data honest:**
- `updateProgress` and `setStatus` (when finishing fills pages) insert an event in the same mutation, so the book and its history can't disagree.
- Undo deletes the event it created instead of adding a negative one. The mutation returns the event id, and the toast's Undo passes it back.
- Daily charts sum `pagesDelta` per local day and clip negatives at zero, so typo corrections don't show as "negative reading".
- Re-reading a book: the book row only holds one reading cycle today. If re-reads matter, add a `reads` table later (one row per start/finish cycle) and attach events to a read. Not needed for the first chart.
- Existing books have no history. Don't invent fake events. Charts start from the day the feature ships, optionally with one `import` event per book at its finish date.

**Already decided (2026-10-04):** `startedAt`, `completedAt` and `cancelledAt` store the exact moment, but the app only shows and edits the date. Books imported from Notion have a default time of 12:00 UTC because Notion only had dates, so time-of-day stats should skip them (or ignore lifecycle dates and rely on reading events).

**Charts this enables:** pages per day (line), reading streaks, weekday by hour heatmap, average pages per session, time to finish per book.

## 4. Quick add from ISBN or link

**Goal:** type an ISBN or paste a link and get title, author, cover, publisher, dates, description and genres filled in, like the recipe import.

**Goodreads as the source of truth:**
- The Goodreads API is gone. It stopped issuing keys on 2020-12-08 and shut off existing ones.
- Scraping Goodreads book pages is against its terms of service. The pages also change often, so a scraper would break regularly. Not a good foundation.

**Usable sources:**
- **Google Books API:** free, public volume data works without a key (a key raises quotas). Good coverage of ISBN, publisher, date, description, page count, categories and covers.
- **Open Library:** free, no key. `https://openlibrary.org/isbn/{isbn}.json` and the cover URLs `https://covers.openlibrary.org/b/id/{id}-L.jpg`. Good for covers, subjects and the original work (original title and year).
- **Hardcover:** free GraphQL API with a personal token. Best data for series, user genres and moods. Requires a token from your Hardcover settings.
- **ISBNdb:** paid, so skip it unless the free sources fall short.

**Suggested approach (hybrid):**
1. **ISBN input → deterministic code.** Query Google Books and Open Library in parallel, merge the fields (prefer Google for description and publisher, Open Library for cover and original work), and show a prefilled quick-add panel to confirm. Fast, free and predictable.
2. **Any link (Goodreads, Moly.hu, publisher pages) → AI import.** Reuse the recipe import pattern (`convex/recipesAi.ts`: Gemini with `url_context`) to read the page and extract the same fields. If it finds an ISBN, enrich with step 1. This also covers Hungarian books, which Google Books and Open Library cover less well.
3. **Covers:** download the image into Convex storage at import time instead of hotlinking. Some API cover URLs expire or block hotlinking.
4. **Later:** scan the barcode with the phone camera to get the ISBN.

## Open questions

- Should the Goodreads URL field stay, or become a generic "source link" once books are imported from several sites?
- How much history do we want before building charts: ship event logging first and the chart a few weeks later, so it has data?
- Do we want a Hardcover token stored for the app (series and genres are much better there), or stay with keyless sources?

## Sources

- [Goodreads disables their API program](https://goodereader.com/blog/digital-publishing/goodreads-disables-their-api-program)
- [Goodreads Developers: API deprecation thread](https://www.goodreads.com/topic/show/21788520-api-deprecation)
- [Open Library Books API](https://openlibrary.org/dev/docs/api/books)
- [Google Books API: volumes resource](https://developers.google.com/books/docs/v1/reference/volumes)
- [Hardcover API: getting started](https://docs.hardcover.app/api/getting-started/)
- [Hardcover's Book API as a Goodreads alternative](https://www.emgoto.com/hardcover-book-api/)
