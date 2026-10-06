# Books: ideas for later

Collected on 2026-10-04 while polishing the books feature. Reading progress history was built on 2026-10-06. The rest isn't built yet.

## Reading progress history

**Built on 2026-10-06.** Differences from the plan below:
- `readingEvents.getAll` returns all of a user's events instead of a `getRange`. It is a few events a day, and streaks need every event anyway.
- The stats chart starts at the first logged reading in every tab, not only in "All", so the year the feature shipped doesn't open with months of zeros.
- The book chart draws a monotone curve between reading days instead of a flat line with steps, so a gap between two reading days shows as a slope. The line starts on the start day at the page before the first logged reading (0 for a book started from the beginning), and reading days sit at midday so reading on the start day still comes after that start. After the last reading day, the line stays flat to today or the finish date. Its x axis labels only the first and last day.
- A book's reading is logged in date order. The "Read on" picker blocks days before the book's latest logged reading, and the server moves an entry that is still earlier (a pick on the latest entry's day) to the latest entry's time. Logging an earlier day than the plan's "rare" case allowed made the book chart go down and gave wrong pages per day. A lower page is still allowed, as a correction.
- Audiobooks aren't left out of the stats chart yet, and the heatmap isn't built.

**Goal:** know on which days, and at which times, you read each book. That gives a pages-per-day chart, reading streaks and habit stats, and a short history on each book ("Oct 3: +40 pages").

**Today:** a book only stores its current `pagesRead`. The progress popover (`book-progress.tsx`) saves it through `updateDetails`, and `setStatus` sets it to `pageCount` when you finish a book. Nothing records when a change happened, so the stats page can only group books by their finish date.

### Data model

A new `readingEvents` table with one row per progress change:

| Field | Why |
|---|---|
| `userId`, `bookId` | Ownership and per-book history |
| `pagesRead` | Absolute page after the update, for a per-book progress line |
| `pagesDelta` | Pages added by this update. Negative after a correction. Needed because the page a book was on before the feature shipped is unknown, so deltas can't be computed from `pagesRead` alone |
| `at` | Timestamp of the update |
| `source` | `progress` (popover) or `finish` (finishing fills the remaining pages) |

Indexes: `by_user_and_at` for charts, `by_book_and_at` for a book's own history.

There is no time zone field. The stats page already runs only in the browser (`ssr: false`) and groups by the browser's zone, which is right as long as you read in one zone. Reading while traveling would put those events on the home zone's day and hour, which isn't worth a field for now.

Sessions aren't stored. A "session" is computed when reading: consecutive events on one book less than 30 minutes apart. This keeps writes and Undo simple, and slider fiddling or a typo fix a minute later merges into one session on its own.

### Backend changes (`convex/books.ts`, new `convex/readingEvents.ts`)

1. A helper in `books.ts`, `recordProgress(ctx, book, pagesRead, source)`, that patches the book and inserts the event when the page changes. It returns the event id, or `null` when nothing changed. Every write of `pagesRead` that means "I read" goes through it, so the book and its history can't disagree.
2. A new `updateProgress({ id, pagesRead, readOn? })` mutation that calls the helper and returns the event id. Remove `pagesRead` from `updateDetails` so progress can't bypass the log.
   - Without `readOn`, the event's `at` is the current time. With it, `at` is the picked day, sent by the browser as 12:00 local time on that day.
   - `readOn` can't be in the future or before the book's start day.
   - The book's `pagesRead` is always set to the entered page, and `pagesDelta` is measured from the current page. The date only decides on which day the pages count. `readOn` can't be before the book's latest logged reading (see "Built on 2026-10-06" above).
3. When finishing fills pages, `setStatus` records a `finish` event and returns its id.
4. Undo deletes the event it created instead of adding a negative one:
   - `undoProgress({ eventId })` deletes the event and sets the book back to `pagesRead - pagesDelta`.
   - `restoreStatus` takes an optional `eventId` and deletes that event along with restoring the dates.
5. `applyEdition` clipping `pagesRead` to a smaller page count records nothing. It isn't reading.
6. `remove` deletes the book's events. The stats page already ignores deleted books, so their events would only skew the totals.
7. `readingEvents.getRange({ from, to })` returns the user's events in a time range with the book title and cover id, for charts. `readingEvents.getForBook({ bookId })` returns one book's events, newest first.

### Frontend changes

1. `book-progress.tsx` gets a small "Read on" date under the page field, using the existing `DatePicker` (`src/components/date-picker.tsx`). It defaults to today, so logging today's reading works the same as now, and changing the date is one extra click for the days you forgot. `DatePicker` already blocks future days and needs one new prop to block days before the book's start date. The popover calls `updateProgress`, sending `readOn` only when the picked day isn't today, and passes the returned event id to the Undo toast.
2. `book-status-picker.tsx` does the same for `setStatus` and `restoreStatus`.
3. The book sheet (`$bookId.tsx`) gets a "Reading progress" line chart below the dates, fed by `getForBook`:
   - Each local day with reading is a point at the last page reached that day. The x axis is a time axis, so a week without reading is a week of horizontal space and the line stays flat across it.
   - The y axis runs from 0 to `pageCount`, so the line ends at the top when the book is finished. Without a page count it runs to the highest page reached.
   - The x axis runs from `startedAt` to `completedAt`, `cancelledAt` or today. When the first event is above page 0 (progress logged before the feature shipped), the line starts at that page on that day, and nothing is drawn before it.
   - The tooltip shows the date, the page reached and the pages read that day.
   - The chart is hidden when the book has no events.

### Stats (`stats.tsx`)

- Pages per day: a line chart (shadcn Chart with a Recharts `LineChart`) that follows the year tabs, grouped by the browser's local day. Every day of the selected year gets a point, and days without reading are 0, so the line drops to the axis instead of drawing a straight line across the gap. The current year ends at today. The "All" tab starts at the first event, not at the first finished book, so it doesn't open with years of zeros from before the feature shipped.
- Daily sums add up `pagesDelta` per local day and clip the day's net total at zero, so a typo correction doesn't show as "negative reading".
- Tiles: current streak (consecutive local days with at least one positive event), longest streak, and average pages per session.
- Later: a weekday by hour heatmap. It skips events logged for an earlier day, because their time of day is a 12:00 placeholder. These are the events whose `at` is more than a few minutes away from Convex's `_creationTime`, so they need no extra field.

The tiles that exist now (books read, pages read, average days to finish) stay based on the book rows. They cover years before the feature shipped, and events don't.

### Existing data

Existing books have no history, and no fake events are created for them. A backfill with one event per finished book at its finish date would put a whole book on one day and make the daily chart spike. The charts start on the day the feature ships.

Books imported from Notion have their lifecycle dates at 12:00 UTC because Notion only had dates, so time-of-day stats use reading events only, never lifecycle dates.

**Already decided (2026-10-04):** `startedAt`, `completedAt` and `cancelledAt` store the exact moment, but the app only shows and edits the date.

### Rollout

1. Event logging, the dedicated mutations, Undo and the progress chart on the book sheet. The chart makes the data visible from day one, so a bug in logging shows up before the stats depend on it.
2. A few weeks later, the pages-per-day chart and streak tiles, once there is data to show.
3. The heatmap when it seems worth it.

No migration is needed. The table is new, and removing `pagesRead` from `updateDetails` only changes the argument list.

### Out of scope for now

- **Re-reading a book.** The book row holds one reading cycle. If re-reads matter, add a `reads` table later (one row per start/finish cycle) and attach events to a read.
- **Audiobooks.** `pagesRead` means pages, so audiobooks need their own unit (minutes or percent) before their events mean anything in a pages chart. Until then, the chart can leave out books with `readingFormat: 'audiobook'`.

## Wish list

**Goal:** keep books you want but don't have yet apart from "Want to read", which is for books you already have. Wish list books should show their price and availability on Libristo.

**Suggested model:** a `wishlist` status before `not_started`, derived like the others from an optional `wishlistedAt` timestamp. `deriveBookStatus` checks it after the other dates, so starting, finishing or cancelling a book still wins. Moving a book to "Want to read" (you bought it) clears `wishlistedAt`. Adding a book from the catalog could ask which of the two it goes to.

**Open question:** does a borrowed or library book count as "have"? If it does, "Want to read" means "can read now" and the wish list means "need to get it".

**Libristo, checked on 2026-10-05:**
- Libristo has no public API.
- Its search pages (`libristo.hu/hu/kereses?t=<ISBN>`) sit behind a Cloudflare challenge. A request from the server gets a 403, so the app can't read prices from the website.
- The affiliate program runs through CJ (Commission Junction) and includes a product feed with prices. Using it needs an approved CJ publisher account. Then either the CJ product search API is queried per ISBN, or the feed is imported regularly. The catalog has over a million books, so querying per ISBN is the realistic option.
- First step without any integration: a "Find on Libristo" link on wish list books that opens the Libristo search for the book's ISBN in the browser. It shows no price in the app, but it needs no account or approval.

## Per-book reading time

**Goal:** see on each book how long it took to read, and for books in progress, how long ago you started.

**No new data needed:** every book already has `startedAt` and `completedAt`, so both numbers are computed when the book is shown.
- Finished books: days from `startedAt` to `completedAt`, e.g. "Read in 12 days". Count calendar days in local time and include both ends, so a book started and finished on the same day reads "1 day", not "0 days".
- Books in progress: days from `startedAt` to today, e.g. "Started 5 days ago".
- Cancelled books: days from `startedAt` to `cancelledAt`, e.g. "Stopped after 30 days", if worth showing.
- Books without `startedAt` (finished before tracking, or imported without a start date) show nothing rather than a guess.

**Where:** the book page next to the dates, and possibly a short label on the library list for books in progress. The stats page could add average days per book once this exists.

**Relation to reading progress history:** these numbers need no reading events, so they can ship first, on their own.
