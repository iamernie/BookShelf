# BookShelf

**I created this project to organize My book collection, it's morphed over the years to where it is today.  It started off with me generating all of the code, and now it's a mix of me and AI with the coding. I don't advertise this project, feel free to use it, and if you have issues I'll try to resolve them.**

**Your personal book library, beautifully organized.**

BookShelf is a self-hosted web app for book lovers who want to track their reading, organize their digital library, and discover patterns in their reading habits. Think of it as your cozy digital bookshelf that lives on your own server.


---
# Desgin Update

I've made the decision to streamline BookShelf.  Begining in version 2.11 I'll be removing the Audiobook features, and instead create and integration with Audiobook Shelf.  It has a much more robust enivronment, and being everything in one was driving me insane.  Even if this project is AI assisted.  I'll be looking for other optimizations over the next few releases.

---

## What Can It Do?

### Organize Your Collection
- Add books manually or import from **Goodreads**, **Audible**, or **CSV**
- Organize with **tags**, **genres**, and **series** tracking
- Create **Smart Collections** (Magic Shelves) that auto-populate based on rules
- **Collapsible sidebar** for a cleaner, focused interface

### Read Your Ebooks
- Built-in reader for **EPUB**, **PDF**, and **CBZ/comics**
- Themes (light, dark, sepia), zoom, and bookmarks
- **Reading progress sync** - your position is always saved
- Reading sessions tracked for statistics

### Track Your Reading
- Set **reading goals**: books per year, pages per month, genres to explore
- 6 challenge types: total books, genre-specific, author challenges, format goals, page counts, monthly targets
- **Reading heatmap** (like GitHub's contribution graph, but for books!)
- Watch your reading streaks grow

### Fetch Metadata Automatically
- Pull book details from **6 providers**: Google Books, Open Library, Goodreads, Hardcover, Amazon, ComicVine
- Grab author bios from **Wikipedia** and Speculative Fiction Fandom
- Cover images, descriptions, page counts, ISBNs - all fetched for you
- **Metadata search modal** with provider tabs and field selection

### Discover New Books
- **Similar Books** recommendations based on shared authors, series, and genres
- **AI-powered recommendations** via OpenAI integration
- Browse by author, series, or genre to find your next read

### Modern Interface
- **BookCard hover actions** - quick access to read, view details, or open menu
- **Book detail tabs** - organized view with Details and Similar Books sections
- **Quick edit overlay** - change rating and status without leaving the page
- **Dark mode** with system preference detection
- Responsive design for desktop and mobile

### Sync With Your E-Reader
- **Kobo Device Sync** - your Kobo e-reader syncs directly with BookShelf
- Tag books with "kobo" to send them to your device
- Reading progress syncs bidirectionally
- Still access your purchased Kobo Store books
- **OPDS catalog** for other e-reader apps (Calibre, KOReader, Moon+ Reader)

### More Goodies
- **BookDrop** folder watching - drop files in, they appear in your library
- **Public Library** for bulk imports and shared collections (Optional)
- **Per-user embeddable widgets** for blogs and websites, each showing only its creator's reading
- **Multi-user** with admin/member roles
- **Statistics dashboard** with charts, timelines, and reading analytics
- **Admin console** with log viewer and diagnostics

---

## 📚 Documentation

**[View Full Documentation →](https://iamernie.github.io/BookShelf/)**

Complete user guides, installation instructions, and API reference available on our documentation site.

---

## Quick Start (Docker)

The easiest way to run BookShelf:

```bash
# 1. Create a directory for BookShelf
mkdir bookshelf && cd bookshelf

# 2. Download the compose file
curl -O https://raw.githubusercontent.com/iamernie/BookShelf/main/docker-compose.yml

# 3. Create your .env file
cat > .env << EOF
SESSION_SECRET=$(openssl rand -hex 32)
ORIGIN=http://localhost:3000
PUID=$(id -u)
PGID=$(id -g)
EOF

# 4. Start it up!
docker compose up -d
```

Open **http://localhost:3000** and the setup wizard will guide you through creating your account.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | Yes | - | Random string for session encryption |
| `ORIGIN` | Yes | `http://localhost:3000` | Your server URL |
| `PORT` | No | `3000` | Server port |
| `DATABASE_PATH` | No | `/data/bookshelf.sqlite` | SQLite database location |
| `PUID` / `PGID` | No | `1000` | User/group ID for file permissions |
| `OPENAI_API_KEY` | No | - | For AI recommendations feature |

**Tip:** Run `id` to find your UID/GID for proper file permissions.

### Audiobookshelf Integration

Connect BookShelf to an [Audiobookshelf](https://www.audiobookshelf.org) server from **Admin → Settings → Integrations**: turn on **Enable Audiobookshelf**, enter the server URL and an API key, click **Test Connection**, then **Save Changes**. That gives you linking and the Listen button. To have BookShelf keep its library in step with Audiobookshelf, also turn on **Sync library items**, pick a **Sync owner** (an admin or librarian who owns the books the sync adds) and a **Sync schedule** (every 15 or 30 minutes, every 1, 6, 12 or 24 hours, or Off for **Sync Now** only).

Each sync reads the whole audiobook library:

- **Matching:** an Audiobookshelf item is linked to an existing book by ASIN, then ISBN, then title. Titles are compared without punctuation, spacing or an "(Unabridged)" suffix, and also by the part before a subtitle ("Into the War: Book 1") or without a trailing book number ("Soldier 1"); those two need the author to agree too. Title matches only link audio-format books. Only the sync owner's books, books in their library and public-library books are considered
- **Never guesses:** when several books could be the item, or the match is only partial, the item waits in the **Needs attention** list on **Admin → Audiobookshelf Sync**, with **Link to this**, **Create new** and **Ignore item** buttons. An item already linked to a book is never added again, whatever its title says
- **New audiobooks:** items with no book are added, linked, owned by the sync owner, with each author as a separate author (the first is primary), the narrator, an audio format and the **Audiobook Shelf** and **Auto-Added** tags. The owner gets a "Book Added" notification for each (or one summary when a run adds more than 10)
- **Filling blanks in Audiobookshelf:** when a linked item has no series, BookShelf sends the book's series and number. With **Fill blank authors and narrators** (on by default) it does the same for an empty author or narrator. Values already in Audiobookshelf are never changed
- **Stale links:** when a linked item is gone (Audiobookshelf answers "not found"), the book shows a **Stale** badge with a **Re-check** button. Nothing is unlinked automatically
- **Listening status** (optional, **Sync listening status**): linked books move to Currently Reading while you're listening and Done when Audiobookshelf marks them finished. It only moves forward and only reads from Audiobookshelf; nothing is ever written back
- **Preview:** a Preview run changes no books and sends nothing to Audiobookshelf, but fills the Needs attention list and shows what a real run would do
- **Admin → Audiobookshelf Sync** lists every run (manual or scheduled, with what it linked, created, pushed, queued and any errors) and the attention list. After three scheduled runs fail in a row, the admin ntfy topic gets one alert and the schedule backs off (up to once a day) until a run succeeds

Linked books get a **Listen on Audiobookshelf** button, and their **Media** tab shows the audiobook's details and your listening progress. Admins can link, re-link or unlink a book by hand from its book page (**Find on Audiobookshelf**, **Change link**, **Unlink**); an item can only be linked to one book. The Integrations tab lists every audiobook that isn't linked yet with a **Find match** button.

### Volumes

BookShelf stores data in these locations:

| Volume | Purpose |
|--------|---------|
| `/data` | SQLite database |
| `/logs` | Application logs |
| `/app/static/covers` | Book cover images |
| `/app/static/ebooks` | Uploaded ebook files |
| `/app/bookdrop` | BookDrop auto-import folder |

---

## Running Locally (Development)

```bash
# Clone and install
git clone https://github.com/iamernie/BookShelf.git
cd BookShelf
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

Visit **http://localhost:5173** (Vite's default port).

---

## Features at a Glance

| Feature | Status |
|---------|--------|
| Ebook Reader (EPUB/PDF/CBZ) | ✅ |
| Reading Progress Tracking | ✅ |
| Reading Goals (6 types) | ✅ |
| Reading Heatmap | ✅ |
| Smart Collections | ✅ |
| Metadata Providers (6 sources) | ✅ |
| Author Wikipedia Fetch | ✅ |
| Similar Books | ✅ |
| AI Recommendations | ✅ |
| Kobo Device Sync | ✅ |
| OPDS Catalog | ✅ |
| BookDrop Auto-Import | ✅ |
| Public Library | ✅ |
| Per-user Embeddable Widgets | ✅ |
| Multi-user | ✅ |
| Dark Theme | ✅ |
| Collapsible Sidebar | ✅ |
| Docker Support | ✅ |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | SvelteKit 2, Svelte 5 (runes), TailwindCSS |
| Backend | SvelteKit API routes |
| Database | SQLite + Drizzle ORM |
| Ebook Reader | epub.js, PDF.js, JSZip |
| Deployment | Docker, GitHub Actions |

---

## Screenshots

*Coming soon!*

---

## Migrating from V1?

V2 is a complete rewrite with a fresh database schema. Your V1 database can be used - migrations run automatically on startup to update the schema.

---

## Roadmap

Check out [ROADMAP.md](ROADMAP.md) for:
- Planned features and in-progress work
- Feature comparison with BookLore
- Implementation details

---

## Contributing

Found a bug? Have a feature idea? Open an issue or PR!

---

## License

MIT - Do what you want, just don't blame me if it eats your homework.

---

**Happy reading!**

---

## Development & Contributions

> **Note:** The GitHub copy of this repository (github.com/iamernie/BookShelf) is a **read-only mirror used for CI/CD builds only** (Docker images via GitHub Actions + Dependabot scanning).
>
> **All pull requests, issues, and bug reports should go to the primary repo on Forgejo:** [https://git.ernieverse.net/ernie/BookShelf](https://git.ernieverse.net/ernie/BookShelf)
