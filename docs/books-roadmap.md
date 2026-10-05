# Books: ideas for later

Collected on 2026-10-04 while polishing the books feature. Nothing here is built yet.

## Reading progress history

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

**Open question:** how much history do we want before building charts? Ship event logging first and the chart a few weeks later, so it has data.
