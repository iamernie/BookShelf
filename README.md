# BookShelf V2

**Your personal book library, beautifully organized.**

BookShelf is a self-hosted web app for book lovers who want to track their reading, organize their digital library, and discover patterns in their reading habits. Think of it as your cozy digital bookshelf that lives on your own server.

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

### More Goodies
- **OPDS catalog** for e-reader apps (Calibre, KOReader, Moon+ Reader)
- **BookDrop** folder watching - drop files in, they appear in your library
- **Public Library** for bulk imports and shared collections
- **Public widgets** for embedding on blogs
- **Multi-user** with admin/member roles
- **Statistics dashboard** with charts, timelines, and reading analytics
- **Admin console** with log viewer and diagnostics

---

## Quick Start (Docker)

The easiest way to run BookShelf:

```bash
# 1. Create a directory for BookShelf
mkdir bookshelf && cd bookshelf

# 2. Download the compose file
curl -O https://raw.githubusercontent.com/yourusername/BookShelfV2/main/docker-compose.yml

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
git clone https://github.com/yourusername/BookShelfV2.git
cd BookShelfV2
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
| OPDS Catalog | ✅ |
| BookDrop Auto-Import | ✅ |
| Public Library | ✅ |
| Public Widgets | ✅ |
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

Check out [docs/ROADMAP.md](docs/ROADMAP.md) for:
- Planned features (Catalog Manager, File Naming Patterns, KOReader sync)
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
