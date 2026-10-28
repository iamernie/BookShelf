# Changelog

All notable changes to BookShelf will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.23.0] - 2026-10-28

### Upgrading: turn sync back on
- After upgrading, Audiobookshelf sync is **off** until you turn it on, even if it ran on a timer before. Go to Admin → Settings → Integrations, turn on **Sync library items**, check the **Sync owner** and the **Sync schedule** (a 6-hour interval carries over as "Every 6 hours"), and save. Until then nothing syncs, and that includes **Sync listening status**: books won't move to Currently Reading or Done from Audiobookshelf progress
- Good first step: run **Sync Now** with **Preview only** ticked. It changes no books, but it fills the new Needs attention list so you can sort out uncertain matches before the first real run

### Added
- New **Admin → Audiobookshelf Sync** page. It lists every sync run, manual or scheduled, with what it linked, created, sent to Audiobookshelf, queued and any errors, and you can open a run to see each book. Preview runs are marked as previews
- **Needs attention** list: when an Audiobookshelf item could be several books (two "Quantum Assault" records, two books with the same ASIN, a title that matches but with a different author), the sync no longer picks one. The item waits here with **Link to this**, **Create new** and **Ignore item** buttons. Items linked to two books show up here too, with **Keep this one**
- **Preview** runs show what a sync would do without changing any books or sending anything to Audiobookshelf
- The sync fills blanks in Audiobookshelf: a linked item with no series gets the book's series and number (2.5 stays 2.5). With **Fill blank authors and narrators** (on by default) an empty author or narrator is filled too. Anything already set in Audiobookshelf is never changed
- **Stale links:** a book whose Audiobookshelf item is gone (Audiobookshelf answers "not found" after a full library scan) gets a Stale badge on its book page with a **Re-check** button. Nothing is unlinked automatically
- **Sync owner** setting: books the sync adds belong to this admin or librarian (on upgrade: the first admin, who owned them before)
- **Sync schedule** choices: every 15 or 30 minutes, every 1, 6, 12 or 24 hours, or Off (Sync Now only). Changes apply without a restart, and a Sync Now run pushes the next scheduled run back
- Books the sync adds get an **Auto-Added** tag, so you can review them, and the sync owner gets a "Book Added" notification for each one (or one summary when a run adds more than 10)
- After three scheduled syncs fail in a row, the admin ntfy topic gets one alert, and scheduled runs wait longer between attempts (doubling, at most once a day) until one succeeds. After downtime the sync catches up with one run, not one per missed interval

### Changed
- Matching is much stricter. Every run reads the whole Audiobookshelf library (not just books added in the last 14 days) and links by ASIN, then ISBN, then title. Titles ignore punctuation, spacing and "(Unabridged)", so "A.I. Battle Station" matches "AI Battle Station". A title can also match without its subtitle or trailing book number, but only when the author agrees. Title matches only link audio-format books; an ebook with the same title gets a separate audio record
- Matching and status sync only look at the sync owner's books, books in their library and public-library books. Other users' personal books are never linked or changed
- An Audiobookshelf item that is already linked to a book is never added again, whatever its title says now
- Authors from Audiobookshelf ("Christopher Hopper, J.N. Chaney") are added as separate authors, and "J. N. Chaney" reuses an existing "J.N. Chaney"
- An Audiobookshelf item can only be linked to one book. Linking it to a second book shows "already linked" (with the other book's title only if you can see that book)
- **Sync listening status** finds Done and Currently Reading by their built-in role, so renaming those statuses no longer breaks it (fresh installs never moved books to Currently Reading before)
- A sync only runs when both **Enable Audiobookshelf** and **Sync library items** are on; Sync Now now runs in the background and the page shows its progress

### Removed
- **Mark finished on Audiobookshelf** (status write-back) is gone. Listening status now only flows from Audiobookshelf into BookShelf; BookShelf never writes progress or finished flags to Audiobookshelf. Items it marked finished before stay as they are
- The **Sync every N hours** setting is replaced by the Sync schedule choices (your value carries over to the nearest choice)
- The old `POST /api/v1/admin/abs/sync` endpoint; Sync Now uses `/api/admin/abs/sync`

### Fixed
- Merging a linked book into another keeps the Audiobookshelf link, and deleting a linked book no longer makes the next sync add it again (the item is listed as ignored on the Audiobookshelf Sync page, where you can let it come back)
- On a brand-new install, books with authors or series could not be saved (missing database columns); they can now
- ntfy notifications whose title has an emoji (Book Added, Book Completed and others) failed to send; they now go through

## [2.22.0] - 2026-10-28
## [2.22.0] - 2026-10-28

### Added
- Widgets now belong to you. Create them under Account > Widgets: pick one of six types (Currently Reading, Recent Reads, Next Up, Upcoming Releases, Reading Stats, Reading Goal), a light or dark theme and how many books to show (1 to 20). Each widget gets its own private URL, plus ready-made iframe code and a live preview
- You can rename a widget, change its theme or book count, get a new URL for it (the old one stops working), or revoke it. Each person can have up to 20 widgets
- Next Up and Upcoming Releases can now be embedded as iframes, not just read as JSON

### Changed
- The admin Widgets page is now called Widgets & API. It shows a list of everyone's widgets (owner, name, type, when it was created and last viewed) with an off switch for each. An admin-disabled widget shows "Not found" and its owner can't turn it back on by getting a new URL, though they can still delete it
- The Widget Access switch is still the master switch: when it's off, every user's widget URLs show "Not found". Users can still manage their widgets while it's off. The v1 API switch and token are unchanged
- The widget builder (type picker, options, preview and embed code) moved from the admin page to Account > Widgets

### Removed
- The old shared widget addresses (`/widgets/api/<type>` and `/widgets/embed`) no longer work and now show "Not found". Create a widget in your account and replace your embed code with the new one

### Fixed
- Widgets show the author and series again. They now read them the same way the dashboard does; before, they came back empty or the widget failed to load
- Reading Stats now count only the books read in the current year for "This Year", and the reading goal widget uses the active goal for the year and counts omnibus editions as several books, matching the Goals page

### Security
- Widgets only ever show the data of the person who created them: their own books, reading status, ratings and dates. Before, every widget showed the whole library, including other users' personal books
- A widget's URL is the only way to view it. Theme and book count come from the saved widget and can't be changed from the URL. A wrong, revoked, disabled or mistyped URL always gets the same "Not found" answer
- Widget URLs are stored only in scrambled (hashed) form, so a copy of the database can't be used to open them. That is why the full URL is shown only once, when you create the widget or get a new URL for it
- Widget URLs are hidden in the server logs, and embedded widgets don't send their URL to other sites when loading images
- Deleting a user also deletes their widgets

## [2.21.4] - 2026-10-28

### Security
- Public widgets and the v1 API now have separate on/off switches on the admin Widgets page. Widgets are now off by default: they only work after an admin turns them on. If widgets are off, widget URLs return "Not found". If an admin had explicitly switched widgets on before, they stay on, so check the Widgets page and switch them off if you don't use them
- The v1 API (token-based access for scripts) keeps working exactly as before and stays on by default. It has its own switch now, so turning widgets off no longer turns the API off. If you had switched the old shared toggle off, the API stays off until you turn it on
- Widget URLs can no longer return your whole library. The number of books is always between 1 and 20, and anything that isn't a number falls back to 5
- Adding a book to your library now checks that you can see it. Public books can still be added by anyone; personal books need to be yours or shared with you
- Updating your personal book data (rating, notes, dates, progress, DNF details) only changes those fields. Before, the request could overwrite any column on the row

## [2.21.3] - 2026-10-28

### Fixed
- Adding a book while viewing the public library now really adds it to the public library. Before, it always ended up in your personal library
- New-book notifications now include the author's name. Before, the name was always missing
- Updating a book through the v1 API now saves the provider rating, rating source and rating count. Before, those three fields were silently ignored even though the API returns them

### Security
- Uploading or removing a book's ebook file now checks that you are allowed to edit that book, using the same rules as editing the book itself. Public library books need a librarian or admin
- Bulk status changes now check each book the same way. Books you are not allowed to edit are skipped and listed in the response instead of being changed
- Only librarians and admins can add books to the public library

## [2.21.2] - 2026-10-28

### Fixed
- The duplicate finder in Data Cleanup now recognizes author names that differ only by punctuation or spacing, like J.N. Chaney and J. N. Chaney. Series names get the same treatment

## [2.21.1] - 2026-10-28

### Fixed
- Books on a shelf's detail page now show the author, series and status like the dashboard cards do

## [2.21.0] - 2026-10-28

### Changed
- The metadata Lookup now works the same everywhere: the edit page, the book page, the Add Book window and the Add to Library page all use one shared implementation instead of four separate copies. Fixes to Lookup now reach every screen at once

### Fixed
- The Add to Library page put the provider's rating (for example a Goodreads average) into your own personal rating. It now saves it as the provider rating, like the other screens, and your personal rating is left alone
- The Add to Library page ignored the author, series and genre choices in Lookup. They are now applied: existing authors, series and genres are matched (including authors written with different punctuation, like "J. N. Chaney" and "J.N. Chaney"), missing ones are created, and new ones appear in the genre list
- The Add to Library page's Lookup message now counts only the fields that were applied and names anything that could not be added, instead of always reporting every selected field as applied

## [2.20.2] - 2026-10-28

### Fixed
- The Lookup button on the book page silently skipped author, series and genre selections. It said the fields were updated but never saved them. It now applies and saves them the same way the edit page does: new authors and series are added alongside the ones the book already has, and missing authors, series or genres are created
- The Lookup completion message now counts only the fields that were actually saved, and names any author, series or genre that could not be added

## [2.20.1] - 2026-10-27

### Fixed
- One place now handles every book status change. Before, four different code paths (book edit, bulk status change, Audiobookshelf sync and the v1 API) stamped reading dates in different ways, and none of them updated your per-user reading record, so the Library header counts drifted from the dashboard. Every status change now updates both, with the same status and dates
- Bulk status changes no longer re-stamp dates or send duplicate completion notifications for books that were already in that status
- Series completion notifications are sent once per series, not once per book in the series
- Audiobookshelf sync now updates your per-user reading record, and only sends a "book completed" notification for books finished today (older finishes it catches up on stay silent)
- The v1 API now stamps the reading start date when a book moves to Current, and updates the per-user reading record too

## [2.20.0] - 2026-10-27

### Security
- Embedded widgets no longer include the API token. Widgets need no token at all now: they are display-only and available whenever widget access is turned on in Admin > Public Widgets. The token shown on that page is only for the v1 API. Embed codes copied before this release still work (the token in them is ignored), but you may want to regenerate the token, since old embed codes exposed it on your website
- The book cover image address is now escaped in the widget embed page. Before, a crafted cover address could be used to run script in the embed page
- The widget data endpoint no longer offers the "all" type, which returned a full dump of the widget data and had no widget behind it
- The API token is now checked with a constant-time comparison
- Widgets embedded on external sites now actually show up. A security header was blocking them in every iframe outside BookShelf; it is now skipped for the widget embed page only

## [2.19.11] - 2026-10-27

### Changed
- A series without a book number can be saved again. Saving is no longer blocked; the series is linked to the book with no number. This undoes the save block added in 2.19.9 and applies to both the book modal and the edit page

## [2.19.10] - 2026-10-27

### Fixed
- Merging duplicate authors or series from the admin Data Cleanup page always failed with "Merge failed". The page sent a different request than the merge endpoint accepts. Author and series merges now work. Book merges were not affected
- The Data Cleanup page now shows the actual error message when a merge fails, not just "Merge failed"
- Applying metadata no longer creates duplicate authors, series or genres. The editor's pick lists can miss an existing entry, for example an author with no books yet. Each time this happened, applying metadata created another copy. BookShelf now reloads the lists and looks again before creating anything. Author names also match when only the punctuation spacing differs, so "J. N. Chaney" and "J.N. Chaney" count as the same author

## [2.19.9] - 2026-10-27

### Fixed
- Removed the "Series Number" checkbox from metadata search. It did nothing, and when ticked it made the applied-fields toast show a false warning. The book number now shows on the Series row itself (for example "Able Bodied Soldier #1") and is still applied with the series
- When applying metadata creates a new author, series or genre and the create fails, BookShelf now reloads the lists once and looks for it again. This covers a series or author added after the editor was opened. If it still can't be added, it is not counted as applied and the toast names it, for example "Applied 7 of 9 fields - could not add: Series 'X'". Before, the failure was only logged to the console and the series seemed not to save
- Saving a book with a series that has no book number is now blocked with a message naming the series, for example "Series 'Able Bodied Soldier' needs a book number before saving". This applies to both the book modal and the edit page

## [2.19.8] - 2026-10-27

### Fixed
- Dates now roll over at midnight in your timezone, not at 7-8 pm. Before, the server used UTC, so evening activity in North America counted as the next day
- Start and finish dates stamped automatically on a status change (single book, bulk change and the service path) now use today's date in the app timezone. Finishing a book at 9 pm no longer records tomorrow's date or, on December 31, counts it toward next year
- Reading stats, current streaks and the reading heatmap now group sessions by app-timezone day. Evening sessions land on the right heatmap cell, evening-only readers keep their streak, and "yesterday" is calendar math, so DST days no longer throw it off. Year and period windows now start and end at local midnight
- Audiobookshelf sync now converts listening and finish times to app-timezone dates. This applies to the start and finish dates set by status sync and to the listening days on the heatmap. Dates already stored are not changed
- Audible import no longer marks a book you listened to today as Read when you import it in the evening
- The upcoming releases widget no longer drops a book releasing today after 8 pm. Magic shelf rules that use "Today" on date fields now use the local date
- "Current year" and "current month" in the dashboard, stats, goals, widgets and reading-session defaults now roll over in the app timezone. A visit on the evening of December 31 no longer creates next year's reading goal
- Export filenames, the author CSV "date added" column and the Kobo publication-date fallback now use the app-timezone date

### Added
- `APP_TIMEZONE` setting (IANA name, default `America/Toronto`) that controls which timezone BookShelf uses for calendar days. An invalid value logs a warning and falls back to the default. It is documented in `docker-compose.yml` and `.env.example`

## [2.19.7] - 2026-10-27

### Fixed
- The metadata toast's "Applied N of M fields" count no longer includes fields that were ticked by default but never shown because the selected result had no value for them, so it no longer warns about fields you never saw
- Removed the "Subtitle" checkbox from metadata search. BookShelf has no subtitle field, so ticking it did nothing
- Provider ratings (rating, source and rating count) now save. The book update endpoint was ignoring them, so ratings applied from metadata search, on either the Edit Book page or the book detail page, were lost on save
- Applying a metadata rating in the book modal now fills in the provider rating instead of overwriting your personal rating. Metadata apply never touches your personal rating, whichever editor you use
- Uploading an ebook on the Edit Book page no longer leads to the next Save clearing the book's format. The page now picks up the eBook format the server assigns when the book had none
- The Edit Book page no longer says "Book saved" when the media sources fail to save. It now shows "Book saved, but media sources failed to save" and stays on the page. Network and other unexpected save errors now show an error message instead of failing silently, and a failed save in the book modal no longer leaves an unhandled error in the console

## [2.19.6] - 2026-10-27

### Fixed
- Applying a "Search Book Metadata" result in the Edit Book page now populates authors, genre and series (with series number) the same way the book modal does: existing selections are deduplicated, matching library entries are reused, and missing authors, series or genres are created. Previously those checked fields were silently ignored and had to be set by hand
- Fetching full details for a metadata result now merges them over the preview instead of replacing it, so fields the provider returns in the preview but omits from the detail payload stay available to apply
- The Edit Book page's metadata toast now reports how many of the selected fields were actually applied (e.g. "Applied 7 of 9 fields") and shows as a warning when some could not be applied

## [2.19.5] - 2026-10-27

### Changed
- Read and Listen actions now render as icon-only buttons across book cards, the book modal, book rows and the book detail page. Each keeps a tooltip and gains an aria-label so screen readers still announce the action; button padding is tightened so the icon buttons stay compact

## [2.19.4] - 2026-10-27

### Fixed
- Date-only values (release, started, completed, birth and death dates) are no longer parsed as UTC midnight. West of UTC every displayed date rendered a day early (e.g. "2026-03-01" showed as February 28), and every save from the book, author or narrator editors shifted the stored date back one more day. Both display and edit paths are fixed centrally in the shared date helpers, so dates now display as stored and saving an editor without touching a date writes it back unchanged
- The same fix applies to changelog / What's New dates, the yearly stats month timeline, the CSV export publication year and the reading heatmap's month labels and tooltips

## [2.19.3] - 2026-10-27

### Changed
- Up Next in Series cards: a pre-release date now renders on its own muted line below the Next line (e.g. "Next: Dead World" with "Nov 24, 2026" underneath) instead of inline beside the title
- Series cards no longer render an empty bottom row; the Rating | Genre | Status row (and its divider line) only appears when it has content, removing the stray horizontal line on dashboard cards

## [2.19.2] - 2026-10-27

### Fixed
- Up Next in Series cards: a pre-release date now renders in parentheses right beside the Next line (e.g. "Next: Dead World (Nov 24, 2026)") and can no longer be truncated away on narrow cards; the long title ellipsizes first instead. The stray dash before the date is gone

## [2.19.1] - 2026-10-27

### Fixed
- Up Next in Series cards no longer hard-truncate: the standalone dashboard section renders them at a wider density (1 / 2 / 3 / 4 across by screen size, never narrower than ~300px) and series title, author, progress count and the Next line ellipsize with hover tooltips instead of cutting mid-word or wrapping "books" onto its own line

## [2.19.0] - 2026-10-27

### Changed
- Up Next in Series (standalone dashboard section) now shows one series card per series instead of book cards: series name, X / Y books progress, and a "Next:" line naming the queued book (with its release date when it's a pre-release). Clicking a card opens the series page

## [2.18.2] - 2026-10-27

### Changed
- Dashboard book cards no longer show tag chips, for a cleaner dashboard. Tags still show everywhere else (library, books, series, authors, shelves, search, book modal)

### Fixed
- Smart collection cards on the dashboard (standalone section and the Currently Reading companion) now show author and series like every other card, instead of the title only

## [2.18.1] - 2026-10-27

### Fixed
- Up Next in Series (standalone section) cards now match the size of the other dashboard sections

## [2.18.0] - 2026-10-27

### Added

- **Pre-release banner** - books with a release date in the future show an amber "Pre-release" banner across the top of the cover on book cards (dashboard, library, books, series, authors, shelves, search) and in the book modal, plus a matching "Pre-release" chip next to the title in list rows. Hover it to see the release date (e.g. "Releases Nov 17, 2026"); it disappears on its own once the release date arrives
- **Up Next in Series as book cards** - the dashboard's Up Next in Series panel (next to Currently Reading) now uses the same book cards as Currently Reading, with quick edit and Read/Listen badges. The per-series "X/Y read" count was removed from this panel; series progress is still shown on the series pages

## [2.17.0] - 2026-10-27

### Added

- **Listen button** - "Listen" button on book cards (dashboard, library grid, series, shelves, authors), the book modal, and list rows for ABS-linked books, opening the item in Audiobookshelf (parity with the detail page's Listen and the ebook Read badge)

## [2.16.0] - 2026-10-27

### Added

- **Audiobookshelf write-back** - optional **Mark finished on Audiobookshelf** toggle (off by default): each sync marks the ABS item finished for every linked Done book, using the book's completed date as the ABS finish date. Only `isFinished`/`finishedAt` are sent, so the listening position is kept and nothing is ever un-finished
- **Write-back ledger** - new `books.absWritebackItemId` column records the item written, so each link is written at most once: re-listening in ABS isn't re-finished, relinking to a different item makes it eligible again, and moving a book off Done never gets pulled back to Done by the status sync from our own write
- **Write-back safeguards** - items linked to more than one book are skipped with a warning; missing ABS items (404) are reported as "missing items" rather than errors; write-back never runs when the progress lookup fails
- **Integrations tab** - pending write-back preview ("Up to N books will be marked finished on the next sync"); Last result and the Sync Now toast show marked-finished and missing-item counts (results stored by older versions still render)

## [2.15.0] - 2026-10-26

### Added

- **Narrator picker with inline create** - Add Book and full edit pages now have a narrator field with inline create (parity with authors), positioned directly under Series in all three surfaces

### Fixed

- **v1 API narrator fixes** - POST creates missing narrator rows instead of silently dropping them; PUT now accepts narratorId/narrator changes (books no longer need delete+recreate), invalid narratorId returns 400

## [2.14.0] - 2026-10-26

### Added

- **Stats heatmap: ABS listening time** - the reading activity heatmap now includes Audiobookshelf listening time with an All / Books / Listening toggle; cells merge reading + listening minutes; graceful fallback when ABS is unconfigured or unreachable

### Changed

- **Heatmap fetching** - the heatmap now makes one request per year or source change (previously two per load)

## [2.13.0] - 2026-10-26

### Changed

- **Nav reorganization** - Series, Authors, and Narrators moved from Manage into the main navigation next to My Books (browse surfaces; Manage keeps Catalog Manager, Genres, Formats, Statuses)
- **Dependency types** - emailService now imports the `Transporter` type directly from nodemailer, which ships its own types since 10.x, resolving the type-check errors left after the nodemailer 10.2.1 bump

## [2.12.9] - 2026-10-26

### Changed

- **Stats fix: completion dates now stamp automatically** - any code path that moves a book into the Done status (including the v1 API) now stamps completedDate when it was previously unset; existing dates are never overwritten.

## [2.12.8] - 2026-10-26

### Changed

- **Security: dependency bumps** - nodemailer 10.0.13 → 10.2.1 (addresses the addressparser recipient-parsing advisories flagged by Dependabot), @sveltejs/kit 2.70.1 → 2.70.3, vite 6.4.3 → 6.4.5 (dev-server advisories).
## [2.12.7] - 2026-10-26

### Changed

- **Shorter Listen button** - The book page top bar button now reads **Listen** (headphones icon, tooltip still says "Listen on Audiobookshelf"). The Integrations tab description was updated to match.

## [2.12.6] - 2026-10-26

### Changed

- **Less clutter in the book page top bar** - The action bar now shows only the **Listen on Audiobookshelf** button, and only when the book is linked. The "Change link", "Unlink", and "Find on Audiobookshelf" controls have moved out of the top bar. Linking, relinking, and unlinking are still available in the Media tab's Audiobookshelf section (book page, book modal, and edit page).

## [2.12.5] - 2026-10-26

### Fixed

- **Media tab count badge** - The badge on the book page's Media tab now counts a linked Audiobookshelf book as well as the ebook (ebook only or Audiobookshelf only = 1, both = 2, neither = no badge). Previously it only appeared for ebooks.

## [2.12.4] - 2026-10-26

### Added

- **Audiobookshelf listening progress in the Media panel** - Linked books show the API key user's progress from Audiobookshelf: a progress bar with "% listened", the position ("9h 42m of 11h 5m"), and a **Finished** badge. Hidden when the book has never been played. Shown on the book page, the book modal, and the edit page Media tab.
  - New admin endpoint `GET /api/v1/admin/abs/progress/{itemId}` proxies Audiobookshelf's `/api/me/progress/{itemId}` (404 with `hasProgress: false` when there is no progress, 502 when Audiobookshelf fails)
- **Sync listening status** (Integrations tab, off by default) - When on, each sync moves linked books to **Current** while they're in progress on Audiobookshelf and to **Done** when finished, filling in start / completed dates that aren't set yet.
  - Advance-only: Done books are never changed and Current books are never re-set, even if Audiobookshelf progress goes back (e.g. a re-listen); books with no Audiobookshelf progress are never touched
  - Statuses are found by name ("Done", "Current", case-insensitive); if one doesn't exist, that step is skipped and a warning is logged
  - Progress for all items is read in a single Audiobookshelf request per sync
  - Status updates are counted in the sync result and shown in the Integrations tab's last result line

## [2.12.3] - 2026-10-26

### Added

- **Audiobookshelf section in the book page Media tab** - Admins see whether the book is linked (with a short item ID) and can use Find on Audiobookshelf / Change link / Unlink directly under the ebook block. Also added to the Media tab of the book modal (formerly the Ebook tab). Hidden when the integration is off or not configured.
- **Audiobookshelf item details** - When a book is linked, the Media section shows what Audiobookshelf knows about the audiobook: narrator(s), series, duration, chapter count, audio files (count, format, total size), published year and publisher, a short description, and an **Open in Audiobookshelf** link. Shown on the book page, the book modal, and the edit page Media tab.
  - New admin endpoint `GET /api/v1/admin/abs/item/{itemId}` proxies Audiobookshelf's item lookup (502 with an error message when Audiobookshelf fails)
  - Details are fetched in the browser when the section opens or the link changes, so page loads never wait on Audiobookshelf

## [2.12.2] - 2026-10-26

### Added

- **Audiobookshelf link controls in the book edit Media tab** - Admins can see whether a book is linked (with the item ID, opening in Audiobookshelf) and use Find on Audiobookshelf / Change link / Unlink right from the Media tab.
  - Uses the same search panel as the book page; changes apply immediately, independent of Save
  - Shown whenever the integration is enabled and configured, regardless of the book's format
- **Audiobookshelf sync status on the Integrations settings tab** - Last successful sync, last run outcome (including the error text when it failed, or an error count when it completed with errors), books linked / created / errors / duration, and the estimated next scheduled run.
  - Every sync run (scheduled and manual) now saves its result to the server-managed `integration.abs_last_result` setting

### Fixed

- **Find on Audiobookshelf missing for some audiobooks** - The book page button only appeared for formats named exactly "Audio" or "Audiobook" (so "Audible Audio" never got it). It now shows for any unlinked book when the integration is configured and the user is an admin.

## [2.12.1] - 2026-10-26

### Added

- **"Audiobook Shelf" system tag** - Books matched to Audiobookshelf are now tagged automatically.
  - The tag is created on first use (an existing tag with the same name, any case, is reused and marked as a system tag)
  - Auto-linked, born-linked (reverse sync), and manually linked books get the tag right away; unlinking removes it
  - Every sync self-heals drift: all books with an Audiobookshelf link carry the tag, and no unlinked book does
  - Tag changes only happen while the integration is enabled and configured

## [2.12.0] - 2026-10-26

### Removed

- **Built-in audiobook upload and player** - Audiobooks are now handled entirely through the Audiobookshelf integration.
  - Removed the `/audiobooks` pages, the audio player, the audiobook section of the book edit page's Media tab, and the `/api/audiobooks` endpoints
  - The `audiobooks`, `audiobook_files`, `audiobook_chapters`, `audiobook_progress`, `audiobook_bookmarks`, and `user_audiobooks` tables are dropped on startup (a database backup is taken first; drizzle migration `0003_drop_legacy_audiobooks`)
  - The "listening hours" stat is gone; narrator counts now come from books only

### Changed

- The **Has Audiobook** magic shelf filter now matches books linked to an Audiobookshelf item
- Any format whose name contains "audio" (for example "Audible Audio") counts as an audiobook format for the unlinked list and the **Find on Audiobookshelf** button, and sync reuses that format instead of creating a new "Audio" one

### Fixed

- **Audiobookshelf rejected valid API keys** - BookShelf sent the key in an `x-api-key` header, which Audiobookshelf ignores, so **Test Connection** and sync returned 401 Unauthorized. The key is now sent as `Authorization: Bearer <key>`.

## [2.11.1] - 2026-10-26

### Added

- **Manual Audiobookshelf linking on the book page** - Admins (with the integration enabled) can link a book by hand.
  - Unlinked books with the Audio/Audiobook format show **Find on Audiobookshelf**, which opens a search panel pre-filled with the title; the query is editable, and clicking a result links the book so the **Listen on Audiobookshelf** button appears
  - Linked books show **Change link** (same panel) and an **Unlink** control
- **Unlinked audiobooks list** - The Integrations tab lists Audio/Audiobook-format books with no Audiobookshelf link (title, author, **Find match**), with unlinked and linked counts
- **Configurable sync interval** - **Sync every N hours** on the Integrations tab (`integration.abs_sync_interval_hours`, 1-48, default 6). The scheduler re-reads it every check, so changes apply without a restart.
- **Admin endpoints** - `GET /api/v1/admin/abs/search?q=&limit=20` (Audiobookshelf library search: `id`, `title`, `authorName`, `narratorName`, `asin`) and `GET /api/v1/admin/abs/unlinked` (linked/unlinked counts and the unlinked list)

## [2.11.0] - 2026-10-26

### Added

- **Audiobookshelf integration settings** - New **Integrations** tab in Admin → Settings, so the integration is configured entirely in the app (no environment variables).
  - **Enable Audiobookshelf** toggle (`integration.abs_enabled`, off by default), server URL (`integration.abs_base_url`), and API key (`integration.abs_api_key`)
  - The stored API key is never sent back to the browser; the field shows "Saved (hidden)", entering a new value replaces it, and "Remove saved key" clears it
  - **Test Connection** reports the library count and which library will be synced, or the failure reason
  - **Sync Now** runs a sync on demand and shows linked/created counts and the last sync time
- **Audiobookshelf sync** - When enabled, a background sync runs every 6 hours (last run stored in `integration.abs_last_sync`). Failures are logged and never affect the app.
  - Link pass: unlinked books added in the last 14 days are matched by ASIN, then by a single exact-title hit
  - Reverse sync: Audiobookshelf items with no matching title in BookShelf are created already linked, with author and narrator rows created as needed, the Audio format, and Unread status; an unlinked book with the same title is linked instead of duplicated
  - Uses the library whose name contains "audiobook", otherwise the first library
- **Admin endpoints** - `POST /api/v1/admin/abs/test` and `POST /api/v1/admin/abs/sync` (admin session or admin API token)

### Changed

- The **Listen on Audiobookshelf** button now appears only when the integration is enabled
- The `ABS_URL` environment variable is no longer used; set the URL in Admin → Settings → Integrations
- `GET /api/settings` no longer returns the stored Audiobookshelf API key

## [2.10.1] - 2026-10-25

### Fixed

- **Audiobookshelf link on the v1 API** - 2.10.0 wired `absItemId` into the internal `/api/books` routes only, so the external `/api/v1` API silently dropped it.
  - `GET /api/v1/books/{id}` and `GET /api/v1/books` now include `absItemId`
  - `PUT /api/v1/books/{id}` accepts `absItemId` (trimmed; empty string clears the link)
  - `POST /api/v1/books` accepts `absItemId` so books can be created already linked
  - `GET /api/v1/books?absLinked=false` returns only books not yet linked to Audiobookshelf

## [2.10.0] - 2026-10-25

### Added

- **Audiobookshelf link** - Books can now be linked to an Audiobookshelf item via a new `absItemId` field (Drizzle migration plus startup column guard for existing databases).
  - Book page shows a "Listen on Audiobookshelf" button that opens `{ABS URL}/item/{absItemId}` in a new tab, only when the book is linked and an ABS URL is configured
  - ABS base URL resolves from the new `integration.abs_base_url` setting, then the `ABS_URL` environment variable
  - `PUT /api/books/{id}` accepts `absItemId` (empty clears the link); `POST /api/books` accepts `absItemId` so books can be created already linked
  - `GET /api/books?absLinked=false` returns only books not yet linked to Audiobookshelf
  - The existing native audiobook player is unchanged


## [2.9.25] - 2026-10-19

### Security

- **postcss-selector-parser** - Override bumped from ^6.1.3 to ^7.1.6: resolves MEDIUM quadratic-complexity CPU exhaustion in flat selector parsing (development/build chain only, no runtime surface).


## [2.9.24] - 2026-10-19

### Security

- **music-metadata** - Updated direct dependency from ^11.12.3 to ^11.16.0 (locked 11.16.1): resolves 5 MEDIUM advisories - MP4 stsd sample-entry infinite loop, APEv2 parser uncontrolled memory allocation, EBML element-length memory exhaustion, ID3v2 tag-size memory-extinction DoS, and uncatchable process crash parsing a crafted .dsf. BookShelf parses user-supplied audiobook files, so these are real attack surface, not lint.
- **source-map-js** - Override added at ^1.2.2 (transitive via postcss@8.5.23): resolves HIGH event-loop DoS through indexed source-map section offsets.
- The remaining open Dependabot alerts (adm-zip, nodemailer, devalue, moment families) are false positives: the lockfile and production code are already at or past every patched version. A manifest-touching commit nudges GitHub's dependency graph to re-analyze; they should auto-close within 5-20 minutes.


## [2.9.23] - 2026-09-30

### Security

- **adm-zip** - Override bumped to ^0.6.1: resolves uncontrolled memory allocation via declared uncompressed size (HIGH) and moves the lockfile out of the vulnerable 0.5.9-0.6.0 symlink-traversal range (MEDIUM).
- **devalue** - Override bumped to ^5.9.2: resolves DoS via malformed input (MEDIUM).
- **nodemailer** - Updated to ^10.0.13: resolves 5 HIGH advisories (process-global DNS cache TLS servername reuse, nested structured recipient stack exhaustion, RFC 5322 comment parsing malformed envelope, addressparser quadratic backtracking, O(n^2) comment-joined address DoS). BookShelf uses only createTransport/sendMail, which is unchanged in v10.
- **moment** - Override added at ^2.31.0: resolves path traversal via crafted non-string locale name (MODERATE, transitive via winston-daily-rotate-file).

### Added

- **Analytics injection** - Optional `UMAMI_SNIPPET` env var (full script tag) injects a tracker before `</body>` on server-rendered pages; unset = zero markup. Repos stay analytics-clean for public mirrors; the value is operator-set in the deployment environment only.
## [2.9.22] - 2026-09-15

### Security

- **nodemailer** - Updated to ^9.1.1 to resolve 4 Dependabot alerts: resolveContent() MailMessage bypass (MEDIUM), O(n^2) addressparser DoS (HIGH), IDN/Punycode domain allow-list bypass (MEDIUM), RFC 5322 comment mis-parse (MEDIUM).
- **@sveltejs/kit** - Refreshed to 2.70.3 (devDependency, in-range) to clear moderate advisory affecting <= 2.70.1.
- **nanoid** - Transitive bump to 3.3.19 to clear high advisory affecting < 3.3.18.

Known remaining: adm-zip (via epub2) advisory has no patched release yet (advisory first-patched: none; fix would require downgrading epub2 to 2.0.7). npm audit: 2 moderate remaining (adm-zip pair only).

## [2.9.21] - 2026-09-02

### Security
- **browserslist** - Added override to ^4.28.7 to resolve high-severity Dependabot alert (transitive dependency via autoprefixer).
- **postcss-selector-parser** - Added override to ^6.1.3 to resolve low-severity Dependabot alert (transitive dependency via tailwindcss/postcss-nested).

## [2.9.20] - 2026-09-02

### Security
- **@xmldom/xmldom** - Updated override from ^0.9.10 to ^0.9.12 to resolve moderate-severity Dependabot alert (CVE-2026-83610), transitive dependency via epubjs.

## [2.9.19] - 2026-08-10

### Security
- **pdfjs-dist** - Updated from 5.7.284 to 6.2.108 to resolve high-severity Dependabot alert (CVE-2026-16633: arbitrary JavaScript execution via malicious PDF).

## [2.9.17] - 2026-06-30

### Security
- **Dependencies** - Updated Vite to 6.4.3 and Nodemailer to 9.0.3 to resolve Dependabot security alerts.

## [2.9.16] - 2026-06-15

### Fixed
- **Docker Build Failure** - Updated Vite build target to ES2022 for compatibility with esbuild 0.28.1

## [2.9.15] - 2026-06-14

### Fixed
- **Series Dropdown on Edit Page** - Fixed "create new series" option not appearing when typing a new series name on book edit page

## [2.9.14] - 2026-06-14

### Fixed
- **Audible Results Crash** - Fixed TypeError when displaying Audible search results
  - Rating field from Audible API was not always a number, causing `.toFixed()` to fail
  - Added proper type checking before formatting rating values
- **Deprecated Meta Tag** - Replaced `apple-mobile-web-app-capable` with `mobile-web-app-capable`

## [2.9.13] - 2026-06-14

### Security
- **esbuild** - Updated to 0.28.1 (fixes remote code execution via NPM_CONFIG_REGISTRY - High)

## [2.9.12] - 2026-06-14

### Fixed
- **Metadata Search Results Not Displaying** - Fixed UI not showing search results
  - Component was not correctly parsing nested API response structure
  - Added Audible to provider names and colors in search modal
  - Updated footer text to reflect current providers

## [2.9.11] - 2026-06-14

### Removed
- **Goodreads Provider** - Removed (blocked by AWS WAF bot detection)
- **Amazon Provider** - Removed (blocked by robot mitigation)
  - These providers cannot work from server environments without a headless browser

### Changed
- **Open Library User-Agent** - Now identifies as BookShelf app for 3x rate limit (3 req/sec)

### Working Providers
- Google Books (with optional API key for higher quota)
- Open Library
- Audible (audiobooks with narrators)
- Hardcover (requires free API key)
- ComicVine (requires free API key)

## [2.9.10] - 2026-06-14

### Added
- **Google Books API Key Support** - Add optional API key for higher quota
  - New setting `metadata.googlebooks_api_key` in admin settings
  - Without API key: uses shared quota (often exhausted)
  - With API key: 1000 requests/day free tier from Google Cloud

### Changed
- **Goodreads Disabled by Default** - Blocked by AWS WAF bot detection
- **Amazon Disabled by Default** - Blocked by robot mitigation
  - Both providers can still be enabled in settings but may not work from server environments

## [2.9.9] - 2026-06-14

### Fixed
- **Audible Provider Missing from Search** - Audible wasn't being configured in metadata search
  - Added Audible settings to settingsService (enabled by default)
  - Added Audible domain setting for regional support
  - Added Audible to the search API's provider configuration

## [2.9.8] - 2026-05-26

### Fixed
- **Audible Search** - Fixed Audible provider returning 0 results
  - Changed from using separate `title` and `author` params to combined `keywords` param
  - Audible API requires the `keywords` parameter for general search

## [2.9.7] - 2026-05-26

### Fixed
- **Metadata Provider User Agents** - All metadata providers now use browser-like user agents
  - Prevents blocking by APIs that reject non-browser requests
  - Updated: Audible, Google Books, Open Library, ComicVine, Hardcover
  - Amazon and Goodreads already had browser user agents

## [2.9.6] - 2026-05-26

### Added
- **Audible Metadata Provider** - New provider for audiobook metadata
  - Searches Audible's public API for audiobook information
  - Returns narrator information (unique to Audible)
  - Includes series information with sequence numbers
  - High-quality cover images (up to 1024px)
  - Runtime in minutes, publisher, release date, ratings
  - Category/genre information from Audible's category ladders
  - Enabled by default as the 7th metadata provider

## [2.9.5] - 2026-05-26

### Fixed
- **Cover Image Download** - Cover images from URLs are now automatically downloaded when adding/editing books
  - Added `coverService.ts` for centralized cover download logic
  - Books API now auto-downloads cover from `originalCoverUrl` if no `coverImageUrl` is provided
  - Works for both creating new books and updating existing ones
- **Series Dropdown** - Fixed "Add new series" option not appearing when no series exist
  - Dropdown now always shows when focused, with helpful prompts
  - Shows "Type to search or create a new series" when empty
- **Narrator Dropdown** - Same fix applied to narrator selection
  - Dropdown now always shows when focused
  - Shows "Type to search or create a new narrator" when empty

## [2.9.4] - 2026-05-26

### Fixed
- **Metadata Search Error Handling** - Improved error reporting for book metadata providers
  - Google Books now properly reports quota exceeded errors (429/RESOURCE_EXHAUSTED)
  - Amazon provider now detects blocking/CAPTCHA and reports meaningful errors
  - Goodreads provider now handles rate limiting and blocking gracefully
  - Open Library provider improved error handling for network issues
  - Search API now returns error details per provider so UI can show what went wrong
  - All providers return `error` and `errorCode` fields when searches fail

### Changed
- **CI/CD Cleanup** - Removed HookFlow deployment webhook from GitHub Actions (server no longer in use)

## [2.9.3] - 2026-05-26

### Security
- **Dependency Updates** - Fixed all 25 Dependabot security alerts
  - Updated `drizzle-orm` to 0.45.2 (fixes SQL injection via improperly escaped identifiers - High x2)
  - Updated `vite` to 6.3.5 (fixes path traversal and WebSocket vulnerabilities - High + Medium)
  - Updated `nodemailer` to 8.0.9 (fixes SMTP command injection via CRLF - Medium x2, Low x2)
  - Updated `svelte` to 5.55.9 (fixes XSS via DOM clobbering, SSR, promises, ReDoS - Medium x4)
  - Updated `@sveltejs/kit` to 2.61.1 (fixes query.batch cross-talk - Medium)
  - Added override for `@xmldom/xmldom` 0.9.10 (fixes XML injection and DoS - High x5)
  - Added override for `fast-xml-builder` 1.2.0 (fixes attribute value bypass - High)
  - Updated override for `devalue` to 5.8.1 (fixes DoS via sparse array - High)
  - Added override for `lodash` 4.18.1 (fixes prototype pollution and code injection - High + Medium)
  - Added override for `picomatch` 4.0.4 (fixes method injection - Medium x2)
  - Resolved all npm audit warnings (0 vulnerabilities)

## [2.9.2] - 2026-03-25

### Fixed
- **API v1 SQL Errors** - Fixed "no such column: bookCount" errors in API v1 endpoints
  - Fixed orderBy clause in authors, narrators, series, genres, formats, and tags endpoints
  - Computed columns now properly referenced in SQLite queries

## [2.9.1] - 2026-03-25

### Fixed
- **Fresh Docker Setup Database Error** - Fixed "no such column: booksContained" error on new container installations
  - Added missing `booksContained` column to auto-migration for fresh databases
  - Fixes GitHub issue #2

## [2.9.0] - 2026-03-25

### Added
- **REST API v1 Fully Featured** - Complete external API for automation and integrations
  - **Search on all resources** - `?search=name` parameter on books, authors, series, narrators, genres, formats, and tags
  - **Full Narrator CRUD** - New endpoints at `/api/v1/narrators` and `/api/v1/narrators/[id]`
    - GET (list with search and pagination), POST (create), PUT (update), DELETE
    - Returns book and audiobook counts per narrator
  - **Full Genre CRUD** - Added POST to `/api/v1/genres` and GET/PUT/DELETE to `/api/v1/genres/[id]`
  - **Full Format CRUD** - Added POST to `/api/v1/formats` and GET/PUT/DELETE to `/api/v1/formats/[id]`
  - **Full Tag CRUD** - Added POST to `/api/v1/tags` and GET/PUT/DELETE to `/api/v1/tags/[id]`
  - **Narrator lookup by name** - Book creation supports `narrator` field (looked up by name) in addition to `narratorId`
  - **booksContained field** - Book creation/response now includes `booksContained` for omnibus editions
  - **originalCoverUrl field** - Book response includes `originalCoverUrl` from metadata sources
  - **Updated API documentation** - OpenAPI spec includes all v1 endpoints with full schema definitions

## [2.8.1] - 2026-03-22

### Security
- **Dependency Updates** - Fixed all Dependabot security alerts
  - Updated `fast-xml-parser` to 5.5.8 via override (fixes entity expansion vulnerabilities - High + Medium)
  - Updated `music-metadata` to 11.12.3 (fixes infinite loop in ASF parser - High)
  - Updated `file-type` to 21.3.4 via music-metadata (fixes ZIP decompression bomb and ASF loop - Medium x2)
  - Updated `devalue` to 5.6.4 via override (fixes prototype pollution - Medium + Low)
  - Resolved all npm audit warnings (0 vulnerabilities)

## [2.8.0] - 2026-03-07

### Added
- **Omnibus/Collection Support in Statistics** - Books can now count as multiple books in your reading stats
  - New "Books Contained" field in the book editor (Basic Info tab)
  - Automatically calculated from series book ranges (e.g., books 1-5 = 5 books)
  - Can be manually overridden for collections, anthologies, or omnibus editions
  - Affects all statistics: total books, books read this year, reading goals, etc.
  - Default value is 1 for regular books

## [2.7.7] - 2026-03-03

### Security
- **Dependency Updates** - Fixed all security vulnerabilities
  - Updated `svelte` to 5.53.7 (fixes XSS vulnerabilities in SSR)
  - Updated `rollup` to 4.59.0 (fixes arbitrary file write via path traversal)
  - Updated `fast-xml-parser` to 5.3.8 (fixes stack overflow in XMLBuilder)
  - Updated `@sveltejs/kit` to 2.53.3 (fixes DoS in form handling)
  - Resolved all npm audit warnings (0 vulnerabilities)

## [2.7.6] - 2026-03-03

### Fixed
- **Metadata Search Not Applying Authors/Series/Cover** - When adding a new book via metadata search, authors, series, and cover image were not being saved
  - Authors, series, and genres are now included in default selected fields
  - `applyMetadataResult` now handles authors (lookup or create by name)
  - `applyMetadataResult` now handles series with book number (lookup or create by name)
  - `applyMetadataResult` now handles genres (lookup or create by name)
- **Cover Images Not Displaying** - Book covers from metadata search now display properly
  - Added `originalCoverUrl` fallback to all book display components
  - Library cards, rows, modals, and search results now show external cover URLs when local cover not downloaded

## [2.7.5] - 2026-02-27

### Added
- **Full REST API v1 Write Operations** - Complete CRUD support for the REST API
  - POST, PUT, DELETE for `/api/v1/books` - Create, update, and delete books
  - POST, PUT, DELETE for `/api/v1/authors` - Create, update, and delete authors
  - POST, PUT, DELETE for `/api/v1/series` - Create, update, and delete series
  - Status/genre/format lookup by name (case-insensitive)
  - Full API specification available at `GET /api/v1?token=YOUR_TOKEN`

## [2.7.0] - 2026-02-08

### Added
- **API Token Authentication** - Full API token system for external integrations
  - Users can generate API tokens from Account → API Tokens page
  - Tokens use secure `bks_` prefix format with SHA-256 hashing
  - Support for optional expiration dates
  - Bearer token authentication for all API endpoints
  - Token management UI with create, view, and revoke functionality
  - Last used tracking for security monitoring

### New API Endpoints
- `GET /api/tokens` - List all API tokens for authenticated user
- `POST /api/tokens` - Create a new API token
- `DELETE /api/tokens` - Revoke all tokens
- `GET /api/tokens/[id]` - Get a specific token
- `PUT /api/tokens/[id]` - Update token name
- `DELETE /api/tokens/[id]` - Revoke a specific token

## [2.6.19] - 2026-01-24

### Fixed
- **Dashboard Chart** - Fixed "Books Read This Year" chart showing 0 instead of actual count
  - Chart was querying wrong table (`userBooks` instead of `books`)
  - Now uses same data source as the "Read This Year" stat for consistency

## [2.6.18] - 2026-01-23

### Security
- **Dependency Updates** - Fixed all security vulnerabilities
  - Updated `bcrypt` from 5.1.1 to 6.0.0 (fixes high severity tar vulnerabilities)
  - Updated `@sveltejs/kit` to 2.50.1
  - Updated `svelte` to 5.48.1
  - Updated `@sveltejs/adapter-node` to 5.5.2
  - Fixed lodash prototype pollution vulnerability
  - Resolved all npm audit warnings (0 vulnerabilities)

## [2.6.17] - 2026-01-12

### Fixed
- **EPUB Reader Progress Percentage** - Fixed reading percentage always showing 0%
  - epub.js requires locations to be generated before percentage can be calculated
  - Now generates locations on book load so percentage tracking works immediately
  - Progress bar now shows actual reading progress

## [2.6.16] - 2026-01-12

### Fixed
- **Kobo Reading Progress Regression** - Fixed reading progress being reset to 0% by race conditions
  - Web reader sometimes sends 0% progress on initial load or visibility changes
  - Now prevents overwriting higher progress with lower values
  - Kobo sync will no longer regress progress to 0%

## [2.6.15] - 2026-01-12

### Fixed
- **Kobo Reading Progress Sync (Web → Device)** - Improved reading state sync from web reader to Kobo devices
  - Changed from `ChangedReadingState` to `ChangedEntitlement` format for better device compatibility
  - Added `PriorityTimestamp` field to reading state for proper sync ordering
  - Added debug endpoint for viewing reading state sync status
  - Kobo devices should now receive reading progress updates from the web reader during sync

## [2.6.14] - 2026-01-12

### Fixed
- **Kobo Settings Authentication** - Fixed "Unauthorized" error when enabling Kobo sync from settings page
  - The `/api/kobo/settings` endpoint was incorrectly bypassing session authentication
  - Settings endpoint now properly authenticates via session cookie like other API endpoints

### Changed
- **UI** - Increased sidebar logo size by 20% for better visibility

## [2.6.10] - 2026-01-07

### Fixed
- **Kobo Reading Progress Sync** - Fixed bidirectional reading progress sync between web reader and Kobo devices
  - Web reader progress now syncs to Kobo devices during next sync
  - Fixed `ChangedReadingState` format to use nested `ReadingState` wrapper expected by Kobo devices
  - Added `lastSyncedToDevice` tracking to detect unsynced progress updates

## [2.6.5] - 2026-01-06

### Fixed
- **Kobo Initialization** - Added many missing fields to the initialization response that Kobo devices expect
  - Added `api_endpoint`, `reading_services_host`, `user_ratings`, `autocomplete`, `store_search`, and many other fields
  - Now matches the configuration format used by other Kobo sync implementations (calibre-web, BookLore)
- **Kobo Debug Logging** - Added request logging to initialization and sync endpoints to help diagnose connection issues

## [2.6.4] - 2026-01-06

### Changed
- **Kobo Debug Endpoint** - Added entitlement generation test to debug endpoint for troubleshooting sync issues

## [2.6.3] - 2026-01-06

### Fixed
- **Kobo Sync** - Fixed books without ebook files being incorrectly marked as synced
  - Only books that actually generate entitlements (have ebook files) are now marked as synced
  - Debug endpoint now shows ebook path info to help diagnose sync issues
- **Kobo Sync Book Filtering** - Fixed books with no owner (from single-user setups) not appearing in Kobo sync

## [2.6.1] - 2026-01-06

### Fixed
- **Kobo API Authentication** - Fixed Kobo sync endpoints requiring session auth instead of token-based auth
  - Kobo devices now properly authenticate via the token in the URL path
  - Previously, requests would redirect to login page

## [2.6.0] - 2026-01-06

### Added
- **Kobo Device Sync** - Sync your BookShelf library directly to Kobo e-readers
  - BookShelf acts as a Kobo sync server - your device connects to BookShelf instead of Kobo's servers
  - **Tag-based sync**: Add the "kobo" tag to any book to sync it to your device
  - **Reading progress sync**: Bidirectional progress synchronization between device and BookShelf
  - **Kobo Store proxy**: Still access your purchased Kobo books - those requests are forwarded to Kobo's servers
  - New settings section with detailed setup instructions for configuring your Kobo device
  - Connected device tracking with last sync time
  - Troubleshooting guide included in settings

### Technical Details
- New database tables: `kobo_users`, `kobo_devices`, `kobo_sync_state`, `kobo_reading_state`
- New API endpoints under `/api/kobo/[token]/v1/`:
  - `/initialization` - Kobo resources configuration
  - `/library/sync` - Library sync with pagination
  - `/library/[bookId]/metadata` - Book metadata
  - `/library/[bookId]/state` - Reading state (GET/PUT)
  - `/books/[bookId]/download` - Ebook download
  - `/books/[imageId]/thumbnail/...` - Cover images
  - `/auth/device` and `/auth/refresh` - Device authentication
  - Catch-all proxy for Kobo store requests

## [2.5.24] - 2026-01-05

### Fixed
- **Ebook Download** - Fixed 404 error when downloading ebooks from the media page
  - Added missing `/api/ebooks/[id]/download` endpoint
  - Downloads now trigger proper file download (attachment) instead of inline viewing

## [2.5.23] - 2026-01-05

### Added
- **KOReader Sync Info** - Added info box in KOReader settings explaining sync limitations
  - Clarifies that KOReader → Browser works perfectly
  - Explains that Browser → KOReader only syncs percentage (not exact position)
  - Recommends reading a few pages on KOReader first for best sync experience

## [2.5.22] - 2026-01-05

### Fixed
- **KOReader Sync** - Prevent false sync prompts when browser can't provide navigation data
  - KOReader uses XPointer format for EPUB navigation; browser uses EPUB CFI (incompatible)
  - When no valid XPointer exists, return null so KOReader doesn't show misleading prompts
  - Browser progress is still stored internally but not advertised until KOReader provides XPointer
  - **How sync works now**:
    - KOReader → Browser: Works perfectly (browser uses percentage)
    - Browser → KOReader: Only prompts if KOReader previously set an XPointer (navigates to last KOReader position)
    - If you only read in browser, KOReader won't prompt until you also read on device

## [2.5.21] - 2026-01-05

### Fixed
- **KOReader Sync Navigation** - Only return valid XPointer to KOReader
  - KOReader calls `GotoXPointer(progress)` which fails with non-XPointer strings
  - Now returns empty progress string unless it's a valid XPointer (starts with `/`)
  - KOReader will show "continue at X%?" but won't navigate to wrong location
  - This matches Booklore's approach: web and KOReader track positions separately

## [2.5.20] - 2026-01-05

### Fixed
- **KOReader Sync Position Format** - Preserve XPointer when syncing from browser
  - KOReader uses XPointer format for EPUB positions, not EPUB CFI
  - Browser was overwriting KOReader's XPointer with incompatible CFI format
  - Now preserves KOReader's XPointer and only updates percentage
  - This fixes "goes to title page" issue when syncing from browser to KOReader

## [2.5.19] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Algorithm** - Finally correct! 32-bit overflow means offset 0 first
  - LuaJIT `lshift(1024, 30)` = 0 due to 32-bit signed integer overflow
  - So i=-1 produces offset 0, not a huge number that gets skipped
  - **Correct offsets**: 0, 1024, 4096, 16384, 65536, 262144, 1048576, ...
  - Verified by downloading epub and comparing hash with KOReader's actual hash
  - **IMPORTANT**: After upgrading, run "POST /api/admin/rehash-ebooks?force=true"

## [2.5.18] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Algorithm** - Wrong assumption about overflow (superseded by 2.5.19)
  - Assumed `1024 << 30` was huge, but it's actually 0 in 32-bit signed
  - Effective offsets: 1024, 4096, 16384, 65536, ... (missing offset 0)
  - Reference: http://bitop.luajit.org/api.html
  - **IMPORTANT**: After upgrading, run "POST /api/admin/rehash-ebooks?force=true"

## [2.5.17] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Algorithm** - Incorrect assumption about Lua lshift (superseded by 2.5.18)
  - Incorrectly assumed negative shift acts as right shift
  - Offsets: 256, 1024, 4096... was wrong
  - Reference: https://github.com/koreader/koreader/discussions/14448
  - **IMPORTANT**: After upgrading, run "POST /api/admin/rehash-ebooks?force=true"

## [2.5.16] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Algorithm** - Use Booklore's proven implementation (superseded by 2.5.17)
  - Matches Booklore's Java FileFingerprint.java exactly
  - Offsets: 1024, 4096, 16384, 65536, ... (starting at i=0)
  - This implementation is known to work with KOReader devices
  - **IMPORTANT**: After upgrading, run "POST /api/admin/rehash-ebooks?force=true"

## [2.5.15] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Algorithm** - Attempted Lua lshift matching (superseded by 2.5.16)

## [2.5.14] - 2026-01-05

### Added
- **Delete KOReader Sync Entries** - Added delete button to remove individual sync entries from KOReader settings
  - Useful for cleaning up stale or duplicate progress entries after hash algorithm changes
  - Each recent activity entry now has a trash icon to delete it

## [2.5.13] - 2026-01-05

### Fixed
- **KOReader Bidirectional Sync** - Fixed browser-to-KOReader progress sync not working
  - Previous algorithm started reading at offset 0 due to JavaScript bit shift behavior with negative numbers
  - Now matches Booklore's proven Java implementation: starts at offset 1024 (i=0), not offset 0
  - **IMPORTANT**: After upgrading, run "POST /api/admin/rehash-ebooks?force=true" to recalculate all hashes
  - Then sync from KOReader once to update progress entries with correct hashes

## [2.5.12] - 2026-01-05

### Fixed
- **KOReader Progress Not Loading in Browser Reader** - Fixed critical bug where progress from KOReader wasn't applied when opening book in browser
  - KOReader stores percentage as 0-1 (e.g., 0.30 for 30%), but browser reader expected 0-100
  - `syncProgressToBook` now converts KOReader percentage to 0-100 format before storing
  - Browser reader now normalizes percentage values, handling both formats for backwards compatibility
  - Books synced from KOReader will now correctly resume at the synced position

## [2.5.11] - 2026-01-05

### Fixed
- **Chapter Title Update Error** - Fixed "Cannot read properties of undefined (reading 'then')" error
  - `book.navigation.get()` can return undefined or a synchronous value, not always a Promise
  - Now checks if result is a Promise before calling `.then()` on it
  - Handles both async and sync navigation results correctly

## [2.5.10] - 2026-01-05

### Fixed
- **Browser Reader Null Reference Errors** - Fixed console errors when reading ebooks
  - Added null checks to `updateProgress`, `saveProgress`, and `saveProgressBeacon` functions
  - Prevents "Cannot read properties of null" errors in epub.js location handling
  - Reader now gracefully handles incomplete location data from epub.js events

## [2.5.9] - 2026-01-05

### Added
- **Reading Progress Display on Book Page** - Show ebook and audiobook progress
  - Ebook card shows progress bar, percentage, and "Last read X ago"
  - Audiobook section shows listening progress and "Last listened X ago"
  - Button changes from "Read/Listen" to "Continue" when there's progress

## [2.5.8] - 2026-01-05

### Fixed
- **Browser Reader KOReader Progress Crash** - Fixed "Cannot Read Book" error when opening books with KOReader-synced progress
  - KOReader uses different location format than EPUB.js CFI
  - Now falls back to percentage-based navigation when CFI location is invalid
  - Reader checks for "epubcfi" prefix before attempting CFI-based navigation

## [2.5.7] - 2026-01-05

### Fixed
- **KOReader MD5 Hash Compatibility** - Fixed MD5 hash mismatch between BookShelf and KOReader
  - Implemented KOReader's partial MD5 algorithm (samples 1024-byte chunks at specific offsets)
  - BookShelf now generates the exact same MD5 hash that KOReader uses
  - Previously, full-file MD5 was used which didn't match KOReader's partial MD5
  - Reference: KOReader GitHub Discussion #14448

### Added
- **Regenerate All Hashes** button in Admin Settings → Storage
  - Use `?force=true` parameter with POST /api/admin/rehash-ebooks to regenerate ALL ebook hashes
  - Needed after algorithm change to update existing hashes to KOReader-compatible format
- Admin UI now shows separate buttons for "Generate Missing" vs "Regenerate All"

## [2.5.6] - 2026-01-05

### Added
- **Manual KOReader Progress Linking** - Link unlinked KOReader sync entries to books in your library
  - Useful when the same ebook has different MD5 hashes (e.g., sideloaded vs OPDS-downloaded versions)
  - Unlinked entries show a "Link" button in Account Settings → KOReader Sync
  - Search for books by title or author to link
  - Linking also updates the book's MD5 hash for future automatic syncing

## [2.5.5] - 2026-01-05

### Added
- **MD5 Hash Generation UI** - Admin button in Settings → Storage to generate missing ebook MD5 hashes
  - Shows stats: how many ebooks have hashes vs need them
  - One-click generation for all missing hashes
  - Required for KOReader sync to match ebooks uploaded before v2.5.2
- **Detailed KOReader sync error messages** - Browser console now shows specific failure reasons
  - `No KOReader credentials configured` - Need to set up credentials in Account Settings
  - `KOReader sync is disabled` - Need to enable sync in Account Settings
  - `Book has no MD5 hash` - Run the hash generation in Admin Settings

## [2.5.4] - 2026-01-05

### Added
- **Browser console logging for KOReader sync** - See sync status directly in browser DevTools console
  - Shows `[KOReader Sync] Progress synced to KOReader: XX%` when sync succeeds
  - Shows `[KOReader Sync] Not synced (no credentials, disabled, or missing MD5 hash)` when sync fails
- API now returns `koreaderSynced` boolean in progress save response

## [2.5.3] - 2026-01-05

### Fixed
- **KOReader Sync Percentage Fix** - Fixed percentage conversion between browser (0-100) and KOReader (0-1) formats
- Added admin endpoint `POST /api/admin/rehash-ebooks` to compute MD5 hashes for existing ebooks
- Added detailed console logging for KOReader sync debugging

### Technical
- Books uploaded before v2.5.2 need MD5 hashes computed via the admin endpoint for sync to work

## [2.5.2] - 2026-01-05

### Added
- **KOReader ↔ BookShelf Bidirectional Sync** - Reading progress syncs between e-reader and browser
  - Progress from KOReader automatically updates the book's reading position in BookShelf
  - Progress from BookShelf's browser reader syncs back to KOReader
  - Automatic matching via MD5 hash of ebook files
  - When you read on your Kobo, you can continue in the browser (and vice versa)
  - Works with EPUB, PDF, and CBZ files

### Technical
- Added `ebookMd5` column to books table for ebook file identification
- MD5 hash computed and stored when ebooks are uploaded or imported
- Bidirectional sync only occurs when book has matching MD5 hash

## [2.5.1] - 2026-01-05

### Added
- **KOReader Sync Activity History** - See recent sync activity in the KOReader settings panel
  - Shows last 5 sync events with book title, progress percentage, device name, and relative time
  - Visual progress bars for each synced document
  - Displays total sync entry count

## [2.5.0] - 2026-01-05

### Added
- **KOReader Sync** - Sync reading progress from KOReader on e-readers (Kobo, Kindle, etc.)
  - Compatible with KOReader's built-in sync protocol (KOSync)
  - Configure KOReader credentials in Account Settings → KOReader Sync
  - Progress syncs automatically when reading on your e-reader
  - Separate credentials from your BookShelf login (username/password for KOReader)
  - Enable/disable sync per user
  - Instructions for configuring KOReader included in the UI

## [2.4.24] - 2026-01-04

### Added
- **Compact Books Toolbar** - Redesigned the books page toolbar to be more space-efficient
  - All controls now fit on a single line (search, sort, view toggle, book count, items per page, pagination)
  - New items-per-page selector: choose between 12, 24, 48, or 96 books per page
  - Inline pagination controls in the toolbar header
  - Reduced vertical space usage for more room to display books

### Fixed
- **OPDS Ebook Downloads** - Fixed ebook downloads not working from OPDS clients (e-readers)
  - Created dedicated OPDS download endpoint at `/opds/download/[id]` with Basic Auth support
  - E-readers can now successfully download ebooks using the same credentials as the OPDS catalog

## [2.4.23] - 2026-01-04

### Fixed
- **HTTP Access on Local Networks** - Fixed login not working when accessing via IP address over HTTP
  - Session cookies now use `secure` flag based on ORIGIN setting (https:// = secure, http:// = not secure)
  - Allows self-hosted users to access BookShelf via local IP without HTTPS
  - Created shared cookie utility for consistent cookie settings across all auth endpoints

## [2.4.22] - 2026-01-04

### Fixed
- **Setup Wizard Email Verification** - First admin user created during setup is now automatically email-verified
  - Eliminates chicken-and-egg problem where email isn't configured yet during initial setup
  - Admin can log in immediately after completing the setup wizard

## [2.4.21] - 2026-01-04

### Fixed
- **Fresh Install Schema Errors** - Fixed additional table schema mismatches preventing fresh installations
  - Added missing `slug` column to genres table
  - Fixed series table: uses `title` field (not `name`), added `numBooks`, `comments`, `statusId`, `genreId`
  - Fixed authors table: added `birthPlace` and `comments` columns
  - Fixed seriesstatuses table: added `key` and `isSystem` columns
  - Fixed tags table: added `isSystem` column
  - All raw SQL table definitions now match Drizzle ORM schema

## [2.4.20] - 2026-01-04

### Fixed
- **Fresh Install Setup Error** - Fixed "NOT NULL constraint failed: users.passwordHash" error on new installations
  - Updated database migration to use correct column name (`password` instead of `passwordHash`)
  - Added missing `username` column to users table creation script
  - Synchronized raw SQL schema with Drizzle ORM schema

## [2.4.19] - 2026-01-04

### Added
- **Update Available Banner** - Non-intrusive notification when a new version is released
  - Slim banner appears at the top of the page when an update is available
  - Shows current version and latest version with link to release notes
  - Dismissible - won't show again until a newer version is released
  - Checks GitHub Releases API (cached for 24 hours to minimize API calls)
  - Respects theme colors with accent gradient background

## [2.4.18] - 2026-01-04

### Changed
- **Rebranding** - Renamed "BookShelf V2" to "BookShelf" throughout all documentation
  - Updated package.json name from "bookshelf-v2" to "bookshelf"
  - Updated all docs-site HTML pages with correct GitHub and Docker image URLs
  - Updated README, CONTRIBUTING, ROADMAP, and other documentation
  - Updated Dockerfile labels and docker-compose configurations
  - Standardized GitHub repo URL to `iamernie/BookShelf`
  - Standardized Docker image to `ghcr.io/iamernie/bookshelf`

## [2.4.17] - 2026-01-04

### Changed
- **Sidebar & Profile Menu Redesign** - Cleaner layout for links
  - GitHub icon now appears inline next to version number in sidebar footer
  - Documentation link moved to profile dropdown menu (with external link indicator)
  - Docs URL now points to GitHub Pages

## [2.4.16] - 2026-01-04

### Added
- **GitHub & Documentation Links** - Added links to GitHub repo and documentation in sidebar footer
  - Links appear below the collapse button
  - Work in both expanded and collapsed sidebar modes

## [2.4.15] - 2026-01-04

### Fixed
- **HTML Stripping in Metadata** - Book descriptions from metadata providers now have HTML tags stripped
  - Converts `<br>` tags to newlines for proper paragraph formatting
  - Converts `</p>` tags to double newlines for paragraph breaks
  - Applied to all metadata providers: Google Books, Open Library, Goodreads, Hardcover, Amazon, ComicVine

## [2.4.14] - 2026-01-04

### Fixed
- **Back Button Navigation** - Fixed issue where back button on book detail page would navigate to dashboard instead of the page you came from
  - Now properly stores return URL when navigating from books list (including page number)
  - Falls back to `/books` instead of unpredictable `history.back()`

## [2.4.13] - 2026-01-04

### Changed
- **Improved Cover Image Display** - Book covers now use a modern blur-background technique
  - Full cover image is always visible without cropping (uses `object-contain`)
  - Blurred version of cover fills the background for non-standard aspect ratios
  - Adds subtle drop shadow for depth
  - Applied to BookCard grid, book detail page, similar books, and edit page preview

## [2.4.12] - 2026-01-03

### Security
- **Fixed Code Scanning Alerts** - Resolved 13 high-severity security issues flagged by GitHub CodeQL
  - **Incomplete multi-character sanitization**: Added `stripHtmlTags()` utility that loops until all HTML tags are removed, preventing bypass with nested tags like `<<script>`
  - **Incomplete string escaping**: Added `escapeGraphQLString()` utility that escapes both backslashes and quotes for GraphQL queries
  - **Double escaping vulnerability**: Fixed XML entity decoder to decode `&amp;` last, preventing double-decode attacks
  - Affected services: goodreadsProvider, amazonProvider, comicVineProvider, hardcoverProvider, wikipediaService, narratorService, emailService, ebookMetadataService, settingsService

## [2.4.11] - 2026-01-03

### Security
- **Fixed Dependabot Vulnerabilities** - Resolved 2 security alerts
  - Updated `drizzle-kit` to 0.31.8 (fixes esbuild vulnerability)
  - Added npm overrides for `cookie` (^0.7.0) and `esbuild` (^0.25.0) to patch transitive dependencies

## [2.4.10] - 2026-01-03

### Changed
- **Sidebar Logo Size** - Increased logo size from 32px to 40px for better visibility

## [2.4.9] - 2026-01-03

### Fixed
- **Series Number Spacing** - Added missing space between series name and number on book view page (e.g., "Undying Mercenaries #24" instead of "Undying Mercenaries#24")

## [2.4.8] - 2026-01-03

### Changed
- **Metadata Lookup Button** - Renamed "Update" to "Lookup" for clarity on book view page

## [2.4.7] - 2026-01-03

### Added
- **Provider Ratings** - Imported ratings from metadata providers (Google Books, Goodreads, etc.) are now stored separately from your personal rating
  - New "Community Rating" card on book view page shows the provider's rating, source, and rating count
  - Your personal star rating is never overwritten by metadata imports
  - Provider rating includes source name (e.g., "googlebooks", "goodreads") and total rating count

## [2.4.6] - 2026-01-03

### Fixed
- **Google Books Cover Import** - Fixed blank/placeholder images when importing covers
  - Changed to use zoom=1 (more reliable than higher zoom levels)
  - Added fallback to thumbnail URL if main cover fails
  - Added minimum file size check to reject placeholder images

## [2.4.5] - 2026-01-03

### Added
- **Metadata Lookup Button** - Added "Lookup" button directly on book view page header
  - Quickly search and apply metadata from Google Books, Goodreads, etc. without going to edit page
- **Improved Back Navigation** - After editing a book, back button returns to where you came from (e.g., series page, author page) instead of always going to books list

## [2.4.0] - 2025-12-31

### Added
- **ntfy Push Notifications** - Real-time push notifications via ntfy
  - **Admin Configuration** - New "Notifications" tab in admin settings
    - Enable/disable ntfy system-wide
    - Configure ntfy server URL (default: ntfy.sh)
    - Set admin topic for system notifications (backup completed, etc.)
    - Test notification button for admin topic
  - **User Preferences** - Personal notification settings in account settings
    - Configure your own ntfy topic
    - Master enable/disable toggle
    - Per-event preferences: book added, book completed, goal reached, series completed
    - Test notification button
  - **Automatic Notifications**
    - Book added to library
    - Book marked as completed (READ status)
    - Series completed (all books in series marked as read)
    - Backup completed (admin topic)
  - Works with self-hosted ntfy servers or the public ntfy.sh service
  - Subscribe to your topic in the ntfy mobile app or web UI to receive notifications

## [2.3.0] - 2025-12-31

### Added
- **Create New Entities Inline** - When adding/editing a book, you can now create new authors, series, narrators, and genres directly from the dropdown
  - Type a name that doesn't exist and click "Create [name]" to add it
  - The new entity is immediately selected and available for use
  - Searchable dropdowns for Genre and Narrator (previously simple selects)

## [2.2.28] - 2025-12-31

### Fixed
- **Dashboard Null Rating** - Fixed crash when highest rated book has null rating
  - Added null check before calling toFixed() on rating

## [2.2.27] - 2025-12-31

### Fixed
- **Dashboard Query Fix** - Fixed SQL query using wrong table alias for audiobook_progress
  - Changed raw SQL `ap.duration` to proper Drizzle column references
  - Fixes "no such column: ap.duration" error on dashboard

## [2.2.26] - 2025-12-31

### Fixed
- **Database Migration** - Added missing `duration` and `progress` columns to `audiobook_progress` table
  - Ensures columns exist in upgraded databases

## [2.2.25] - 2025-12-31

### Security
- **Secure Session Cookies** - Session cookies now set `secure: true` in production
  - Prevents session hijacking over unencrypted connections
  - Development mode (HTTP) still works for local testing
- **Settings API Restricted** - Settings endpoint now requires admin role
  - Prevents non-admin users from reading sensitive configuration (SMTP credentials, etc.)

## [2.2.24] - 2025-12-31

### Fixed
- **Build Error** - Fixed duplicate variable declaration in book API endpoint
- **Security Recommendations** - Added security audit document with prioritized recommendations

## [2.2.23] - 2025-12-31

### Fixed
- **What's New Modal Icons** - Fixed section icons not displaying in the What's New changelog modal
  - Changed from direct component tag to `svelte:component` for proper dynamic component rendering

## [2.2.22] - 2025-12-31

### Fixed
- **Public Library Book Editing** - Fixed permission error when editing public library books
  - Admins and librarians can now edit public library book metadata
  - The PUT endpoint was using personal library permission checks for all books
  - Now correctly checks `canManagePublicLibrary` permission for public books

## [2.2.21] - 2025-12-31

### Added
- **Enhanced Dashboard Statistics** - More stats on the dashboard
  - Average pages per book (Avg Pages)
  - Total narrators count
  - Listening hours (for audiobook users)
  - DNF rate percentage (for users with DNF books)
  - Top Narrators section (like Top Authors, for audiobook listeners)
  - Highest Rated Book highlight with cover, title, author, and rating

### Fixed
- **Dashboard Chart Bars** - Fixed "Books Read This Year" chart bars not displaying
  - CSS percentage heights weren't propagating through Tailwind classes
  - Changed to explicit inline height styles for reliable rendering

## [2.2.20] - 2025-12-31

### Fixed
- **Admin Console Logs** - Fixed 404 error on admin logs endpoint in Docker production
  - The `logs/` gitignore pattern was incorrectly ignoring `src/routes/api/admin/logs/`
  - Changed to `/logs/` to only ignore root-level logs directory

### Added
- **Debug Chart Endpoint** - Added `/api/admin/debug-chart` for diagnosing chart data issues

## [2.2.19] - 2025-12-30

### Fixed
- **Dashboard Charts** - Fixed "Books Read This Year" chart not displaying data
  - Date comparisons were failing due to timezone-formatted date strings in SQLite
  - Also fixes "Read This Year" count and "Pages This Year" stats

## [2.2.18] - 2025-12-30

### Added
- **Media Sources** - Track where your books are purchased or owned
  - Add sources like Audible, Kindle, Physical, Kobo, Apple Books, etc.
  - Books can have multiple sources (bought both Kindle and audiobook)
  - "Owned On" badges display on book detail page with icons and colors
  - Manage sources in the new Media tab on book edit page
- **Per-User Private Sources** - Regular users can create their own custom sources
  - Add private sources like local bookstores, Storytel, or any custom source
  - Private sources only visible to the user who created them
  - System-wide sources managed by admins in Admin → Media Sources
- **Media Sources Admin Page** - New admin page to manage system-wide sources
  - Default sources seeded: Audible, Kindle, Physical, Kobo, Apple Books, Google Play Books
  - Customize icons, colors, URLs, and display order
- **Diagnostics Updates** - Media sources now included in database health checks
  - Shows total, system, and user-created source counts
  - Detects orphaned book-media source relationships
  - Detects unused user-created sources
  - Repair functions to clean up orphaned data

### Fixed
- **Ebook Missing Files** - Fixed false "missing" status for uploaded ebooks
  - Ebook existence check now properly resolves storage paths

## [2.2.9] - 2025-12-30

### Added
- **AI Book Recommendations** - Get personalized book suggestions based on any book
  - New "Get Recommendations" button in the Similar Books tab on book detail pages
  - AI analyzes the book's title, author, series, genre, and description
  - Click "Add to Wishlist" to add recommended books directly to your library
  - Requires OpenAI API key configured in Admin Settings

## [2.2.8] - 2025-12-30

### Fixed
- **Ebook Reading Position Sync** - Reading progress now reliably syncs across devices
  - Added `visibilitychange` and `pagehide` event handlers to save progress when page is hidden
  - Using `sendBeacon` API for reliable progress saves on page close/navigation
  - Fixes position not syncing when switching from iPhone to computer
- **Audiobook Access Permissions** - Fixed audiobook streaming for public library audiobooks
  - Stream, progress, and chapters APIs now properly check public access and user library membership
  - No longer incorrectly denies access to audiobooks the user should be able to play

## [2.2.7] - 2025-12-30

### Added
- **Photo Upload for Authors & Narrators** - Add photos via file upload or URL download
  - Upload photos directly from your device on author/narrator edit pages
  - Download photos from any URL (including Wikipedia)
  - Photos served via `/photos/` route for runtime-uploaded content
  - Supports JPG, PNG, GIF, WebP, and AVIF formats

## [2.2.6] - 2025-12-30

### Added
- **Enhanced Narrator System** - Narrators now match the author experience
  - **Narrator Tags** - Tag narrators with custom tags, colors, and icons
  - **Wikipedia Metadata Search** - Look up narrator info from Wikipedia and import bio, photo, dates
  - **Narrator Detail Page** - New `/narrators/[id]` page with inline bio editing, stats, and audiobook grid
  - **Extended Narrator Fields** - Birth/death dates, birthplace, photo URL, website, Wikipedia URL, comments
  - **Narrator Cards** - Show photos, cover images, tags, and audiobook counts on list page

## [2.2.3] - 2025-12-30

### Fixed
- **OIDC Token Exchange** - Fixed "unexpected state response parameter" error
  - Pass `expectedState` to openid-client's `authorizationCodeGrant` for proper CSRF validation

## [2.2.2] - 2025-12-30

### Fixed
- **OIDC Account Linking** - Fixed logged-in users being redirected to dashboard instead of linking their account
  - Account linking now properly handles the `linkingUserId` before checking for existing links
  - Shows appropriate messages for "already linked", "linked to another account", and successful linking
  - Added error/success feedback in the Connected Accounts section

## [2.2.1] - 2025-12-30

### Added
- **OIDC Setup Instructions** - Comprehensive setup guide on the OIDC settings page
  - Step-by-step instructions for Authentik, Keycloak, Google, and GitHub
  - Links to official documentation for each provider
  - Displays the correct Redirect URI (callback URL) to configure
  - Troubleshooting tips for common issues

### Fixed
- **OIDC Authentication** - Fixed redirect loop preventing login with OIDC providers
  - SvelteKit's redirect was being incorrectly caught as an error

## [2.2.0] - 2025-12-30

### Added
- **What's New Modal** - Admin users see a changelog popup after app updates
  - Shows latest version changes with organized sections
  - "Don't show again for this version" checkbox
  - Links to full changelog page at /admin/changelog
  - Toggle in Settings → UI to disable globally
  - Environment variable `DISABLE_WHATS_NEW=true` to disable completely
- **Customizable Dashboard Companion Section** - Choose what shows beside Currently Reading
  - Options: Up Next in Series (default), Smart Collection, or Nothing (full width)
  - Side-by-side layout when companion section has content
  - Configure in Dashboard Settings modal
- **Updated App Logo** - New colorful logo for sidebar, favicon, and PWA icons

### Changed
- Renamed "Continue Reading" to "Currently Reading" throughout the app

## [2.1.1] - 2025-12-30

### Added
- **Inline Rating Control** - Click stars directly on book detail page to rate books
  - Hover effect shows preview of rating
  - Click same star again to clear rating
  - Instant save with toast notification
- **Inline Status Selector** - Change book status directly from detail page
  - Dropdown selector styled with status color
  - No need to enter edit mode
  - Updates immediately via API

## [2.1.0] - 2025-12-30

### Added
- **Author Tags** - Authors now support tags just like books and series
  - Tag authors from their detail page or edit page
  - Tags display on AuthorCard with colors and icons
  - Filter authors by tag from the authors page
- **Improved Tag Visibility** - Tags are now more prominent and interactive
  - BookCard shows up to 4 tags (up from 2) with colors
  - BookRow shows up to 3 tags with colors
  - All tags are now clickable links that filter by that tag
- **Inline Tag Editor** - New component for editing tags directly on detail pages
  - Add/remove tags without opening edit mode
  - Shows tags with colors and icons
  - Used on book detail pages
- **Quick Tag Picker** - New reusable dropdown component for rapid tagging
- **Dynamic Date Filters for Smart Collections** - Use "Today" as a relative date
  - Create shelves like "Upcoming Books" (release date after today)
  - Create shelves like "Recently Released" (release date before today)
  - Date rules now have a dropdown to choose between "Today" or a specific date

## [2.0.0] - 2025-12-29

### Major Release - BookShelf V2

This is the first stable release of BookShelf V2, a complete rewrite from the ground up with modern technologies and a significantly expanded feature set.

### Highlights

#### Complete Audiobook Support
- Full audiobook playback with custom audio player
- Multi-track support (MP3 collections) and single-file M4B audiobooks
- Chapter navigation with automatic chapter detection
- Sleep timer with gradual volume fade
- Bookmarks with notes
- Playback speed control (0.5x - 2x)
- Keyboard shortcuts for hands-free control
- Progress syncing across devices
- Automatic completion tracking (syncs to book status)

#### Progressive Web App (PWA)
- Install BookShelf to your home screen on mobile or desktop
- Offline support via service worker caching
- App-like experience with no browser chrome
- Custom app icons and splash screens
- Quick action shortcuts (Add Book, My Library, Audiobooks)

#### Multi-User System
- Role-based access (admin, member)
- Personal libraries - each user has their own book collection
- Public library for shared books with file requirements
- OIDC/SSO authentication (Authentik, Keycloak, Google, GitHub)
- Invite codes for controlled registration
- Email verification and password reset

#### Customizable Dashboard
- Toggle sections on/off
- Drag-and-drop section reordering
- Smart Collection section (display any Magic Shelf on dashboard)
- Reading goal progress
- Continue Reading, Up Next in Series, Recently Added sections

#### Ebook Reader
- EPUB reader with progress persistence
- PDF viewer
- CBZ comic reader
- Touch navigation on mobile
- Metadata extraction from uploaded files

#### Modern Tech Stack
- SvelteKit 2 with Svelte 5
- SQLite with Drizzle ORM
- TypeScript throughout
- Tailwind CSS
- Lucide icons

### Added
- **PWA support** - Install as app, offline caching, home screen shortcuts
- **Service worker** - Caches static assets for faster loads and offline access
- **Optimized app icons** - Multiple sizes for all platforms (16px to 512px)
- **Web app manifest** - Proper PWA configuration with theme colors and shortcuts

## [0.7.11] - 2025-12-29

### Added
- **Admin settings for audiobook storage** - Configure audiobook storage path and file naming pattern in Settings → Storage
- **Dropdown selectors for settings** - Converted freeform fields to dropdowns where appropriate (Default Role, Default Sort, Default View, Amazon Domain)

### Fixed
- **Mobile audiobook playback** - Fixed audio not playing on mobile devices due to browser autoplay restrictions
- **Mobile ebook navigation** - Fixed ebook reader page navigation not working on mobile devices
  - Added touch zones on left/right edges for tap-to-navigate
  - Added click handler inside epub iframe for navigation
  - Fixed chapter title stuck on "Loading..." - now properly shows chapter name or "Reading..."

## [0.7.10] - 2025-12-29

### Added
- **Public Library Toggle** - Admins can now disable the public library feature in Settings → General
  - When disabled, the "Public Library" sidebar link is hidden
  - Library page only shows personal library tab
  - Add Book page doesn't allow adding to public library
  - Perfect for single-user or family deployments that don't need a shared library

### Changed
- **Consistent media upload buttons** - "Upload Ebook" and "Add Audiobook" buttons on book detail page now have consistent styling and both link to the Media tab in edit mode

## [0.7.9] - 2025-12-29

### Added
- **Customizable dashboard** - Click the gear icon on the dashboard header to:
  - Toggle sections on/off (Reading Goal, Continue Reading, Smart Collection, Up Next in Series, Recently Added, Recently Completed)
  - Drag and drop to reorder sections
  - Add a Smart Collection section that displays books from any Magic Shelf

## [0.7.8] - 2025-12-29

### Changed
- **Renamed "Read" status to "Done"** - To avoid confusion with the "Read" button for reading ebooks, the completed book status is now called "Done" with a circle-check icon. Existing databases are automatically migrated.

### Fixed
- **Import reliability** - Audible and Goodreads imports now use status keys instead of names for more reliable matching

## [0.7.7] - 2025-12-29

### Added
- **Prominent eBook/Audiobook format badges on book cards** - Books with eBook or audiobook files now show prominent "Read" and "Listen" buttons directly on book covers for easy one-tap access to content, especially helpful on mobile devices

### Fixed
- **Global search button now works** - The search magnifying glass icon in the top navigation bar now properly opens the global search modal when clicked
- **Search icon in books page is now clickable** - The search icon in the books page search bar now acts as a submit button

## [0.7.6] - 2025-12-29

### Fixed
- Metadata extraction no longer hangs on large audio files (added timeout and optimized settings)

## [0.7.5] - 2025-12-29

### Added
- Duplicate book detection when uploading files - prevents accidentally adding the same book twice

## [0.5.0] - 2025-12-27

### Added
- **Email/SMTP Settings in UI** - Configure email settings directly from the admin panel
  - New "Email" tab in Settings with SMTP configuration (host, port, SSL/TLS, credentials)
  - Hybrid configuration: environment variables take precedence over UI settings
  - Shows "Configured via Environment Variables" notice when using env vars
  - Test email functionality to verify SMTP configuration
  - Supports common providers (Gmail, Mailgun, SendGrid, SES, etc.)

### Changed
- **Redesigned Settings Page** - New tabbed interface for cleaner navigation
  - Tabs: General, Storage, Metadata, OPDS, Import, Users, Email, SSO, AI
  - SSO tab links to dedicated OIDC provider management page
  - Each tab contains only relevant settings, reducing clutter
- **Reorganized Sidebar** - Cleaner admin navigation
  - Added collapsible "Admin" section for admin users
  - Admin section includes: Users, Invite Codes, BookDrop, Diagnostics, Settings
  - Removed redundant "System Settings" from bottom of sidebar

### Fixed
- Database migration now properly handles settings table schema changes from V1
- User password migration from V1 databases (passwordHash → password column)

## [0.4.4] - 2025-12-27

### Added
- Amazon metadata provider settings (enable/disable, domain selection)
- Comic Vine metadata provider settings (enable/disable, API key)

## [0.4.3] - 2025-12-27

### Added
- OIDC/SSO settings link on admin settings page

## [0.4.2] - 2025-12-27

### Fixed
- Cover images and ebooks now properly served in Docker deployments
  - Added dynamic file serving routes for `/covers/` and `/ebooks/`
  - Fixes issue where runtime-mounted volumes weren't accessible via static paths

## [0.4.1] - 2025-12-27

### Fixed
- V1 to V2 migration now correctly marks existing users as email-verified
  - Existing V1 users no longer blocked from login due to missing email verification

### Added
- Password reset CLI script for Docker deployments
  - Usage: `docker exec -it bookshelf-v2 node scripts/reset-password.js <email> <new-password>`

## [0.4.0] - 2025-12-27

### Added
- **OIDC/SSO Authentication** - Single Sign-On support via OpenID Connect
  - Support for multiple OIDC providers (Authentik, Keycloak, Google, GitHub, etc.)
  - Provider presets for quick configuration (Google, GitHub, Authentik, Keycloak)
  - Admin UI for provider management at `/admin/settings/oidc`
  - Account linking in user settings - connect/disconnect OIDC providers
  - First-time OIDC user flow with option to link existing account or create new
  - Local login always available as fallback
  - Secure state/nonce handling for CSRF protection

- **Database Migration System**
  - Automatic pre-migration backups before schema changes
  - Upgrade progress page at `/upgrade` with real-time status
  - Safe V1 to V2 database upgrades
  - Case-insensitive table name handling

## [0.3.0] - 2025-12-27

### Added
- Multi-user system with roles (admin, member)
- User signup with email verification
- Invite code system for controlled registration
- Admin approval workflow for new users
- Catalog manager for genres, formats, narrators, tags, and statuses

### Changed
- Improved UI consistency across admin pages
- Enhanced settings organization

## [0.2.0] - 2025-12-26

### Added
- EPUB reader with progress tracking
- PDF reader support
- CBZ comic reader
- Reading progress persistence
- EPUB metadata extraction on upload

### Changed
- Improved book detail modal
- Enhanced file upload handling

## [0.1.0] - 2025-12-25

### Added
- Initial release with feature parity to V1
- Book management (CRUD, search, filters)
- Author management with Wikipedia import
- Series management with gap tracking
- Reading status tracking
- Reading goals and challenges
- Statistics dashboard
- CSV/JSON import and export
- Audible library import
- OPDS feed support
- Dark mode
- Mobile-responsive design
- v2.9.18: Security updates — drizzle-orm, xmldom, vite, nodemailer, svelte, lodash CVE fixes
