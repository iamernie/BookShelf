---
layout: default
title: Quick Reference
nav_order: 6
---

# Quick Reference
{: .no_toc }

Quick access to common tasks and shortcuts.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Common Tasks

### Adding Books

| Method | When to Use |
|--------|-------------|
| **Manual Entry** | Custom/personal books |
| **ISBN Lookup** | Books with ISBN |
| **Metadata Search** | Search by title/author |
| **CSV Import** | Bulk import from Goodreads |
| **BookDrop** | Auto-import ebook files |

### Reading Books

1. Library → Hover over book → **Read** button
2. Or: Book details → **Read Book** button
3. Keyboard: `←` / `→` to turn pages, `Esc` to close

### Organizing

**Quick Actions:**
- **Star rating** - Click stars on book card
- **Status** - Click status badge to change
- **Tags** - Book details → Tags section

**Bulk Actions:**
1. Select books (checkboxes)
2. Bulk Actions button
3. Choose operation (status, tags, delete, etc.)

### Smart Collections

1. **Shelves** → **Create Smart Collection**
2. Add rules (genre = Fantasy, rating ≥ 4, etc.)
3. Save → Auto-updates as library changes

### Importing Data

**From Goodreads:**
1. Export Goodreads CSV
2. Import/Export → CSV Import
3. Preview → Import

**From Audible:**
1. Save Audible library HTML
2. Import/Export → Audible Import
3. Upload → Import

### Exporting Data

**Quick Backup:**
1. Import/Export → Backup to JSON
2. Download file
3. Store securely

**CSV Export:**
1. Import/Export → Export CSV
2. Choose columns
3. Download

## Keyboard Shortcuts

### Reader

| Key | Action |
|-----|--------|
| `←` / `→` | Previous/Next page |
| `Home` / `End` | First/Last page |
| `+` / `-` | Increase/Decrease font (EPUB) |
| `Ctrl` `+` / `-` | Zoom in/out (PDF) |
| `F` | Fullscreen |
| `Esc` | Close reader |
| `T` | Table of contents (EPUB) |
| `B` | Bookmarks (EPUB) |
| `S` | Settings (EPUB) |

### Library

| Key | Action |
|-----|--------|
| `Ctrl` `F` | Focus search |
| `Ctrl` `A` | Select all books |
| `Esc` | Clear selection/close modal |
| `Enter` | Open selected book |

## URL Patterns

Quick navigation by URL:

| Page | URL |
|------|-----|
| **Dashboard** | `/` |
| **All Books** | `/books` |
| **Add Book** | `/books/add` |
| **Authors** | `/authors` |
| **Series** | `/series` |
| **Tags** | `/tags` |
| **Shelves** | `/shelves` |
| **Statistics** | `/stats` |
| **Reading Goals** | `/stats/goals` |
| **Import/Export** | `/import` |
| **Settings** | `/settings` |
| **Admin** | `/admin` |
| **OPDS Catalog** | `/opds` |

## Search Tips

### Quick Search

**Search by:**
- Title: `harry potter`
- Author: `sanderson`
- ISBN: `9780765326355`
- Series: `stormlight`

**Autocomplete:**
- Start typing
- Suggestions appear
- Arrow keys to select
- Enter to choose

### Advanced Search

Use filters for precise results:

**Example Combinations:**
- Status: Read + Genre: Fantasy + Rating: 5
- Format: Ebook + Year: 2023
- Author: Sanderson + Series: Mistborn

## Statistics Shortcuts

### Quick Stats (Dashboard)

- Total books
- Books read this year
- Current reading streak
- Average rating

### Detailed Stats

Navigate to **Stats** page for:
- Reading timeline
- Genre breakdown
- Author analytics
- Reading heatmap

### Export Stats

Stats → Export → Choose format (CSV/JSON/Image)

## Smart Collection Examples

**Recent Favorites:**
```
Rating ≥ 4.5
Date Read: Last 6 months
Sort: Date Read (desc)
```

**Unfinished Series:**
```
Series: Status ≠ Complete
Book Status: Read
```

**Quick Weekend Reads:**
```
Page Count: ≤ 300
Status: Want to Read
Format: Paperback OR Ebook
```

**2026 Reading Goal:**
```
Date Read: Year = 2026
Sort: Date Read (asc)
```

## Reading Goal Templates

### Classic Annual Goal

- **Type:** Total Books
- **Target:** 52 books
- **Year:** 2026
- **Result:** One book per week

### Genre Exploration

- **Type:** Genre Challenge
- **Target:** 12 books
- **Genres:** Pick genres you rarely read
- **Timeframe:** 1 year

### Format Diversity

- **Type:** Format Challenge
- **Target:** 24 audiobooks
- **Year:** 2026
- **Result:** 2 per month

### Page Turner

- **Type:** Page Count
- **Target:** 15,000 pages
- **Timeframe:** 1 year

## Import Templates

### Goodreads CSV Mapping

| Goodreads | BookShelf |
|-----------|-----------|
| Title | Title |
| Author | Authors |
| ISBN | ISBN |
| My Rating | Rating |
| Date Read | Completed Date |
| Exclusive Shelf | Status |
| Bookshelves | Tags |

### Calibre CSV Mapping

| Calibre | BookShelf |
|---------|-----------|
| title | Title |
| authors | Authors |
| isbn | ISBN |
| rating | Rating |
| tags | Tags |
| series | Series |
| publisher | Publisher |

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| **Can't log in** | Check password, try password reset |
| **Book not found** | Clear filters, check search spelling |
| **Cover won't load** | Re-upload or use metadata lookup |
| **Reader won't open** | Check file format, try re-upload |
| **Import failed** | Check CSV format, preview first |
| **Search broken** | Admin → Rebuild search index |
| **Permission error** | Check PUID/PGID in Docker |

## Docker Commands

### Basic Operations

```bash
# Start BookShelf
docker compose up -d

# Stop BookShelf
docker compose down

# View logs
docker compose logs -f

# Restart BookShelf
docker compose restart

# Update to latest
docker compose pull && docker compose up -d
```

### Maintenance

```bash
# Backup database
docker exec bookshelf sqlite3 /data/bookshelf.sqlite ".backup '/data/backup.sqlite'"

# Access shell
docker exec -it bookshelf /bin/sh

# View resource usage
docker stats bookshelf
```

## API Quick Reference

Base URL: `http://your-server:3000/api`

### Authentication

All API requests require authentication via session cookie (login first).

### Common Endpoints

```bash
# Get all books
GET /api/books

# Get single book
GET /api/books/:id

# Create book
POST /api/books

# Update book
PUT /api/books/:id

# Delete book
DELETE /api/books/:id

# Search books
GET /api/search?q=query

# Get statistics
GET /api/stats

# Export CSV
GET /api/export/csv

# Import CSV
POST /api/import/csv/preview
POST /api/import/csv/execute
```

### Response Format

```json
{
  "id": 1,
  "title": "Book Title",
  "rating": 4.5,
  "status": "Read"
}
```

### Error Format

```json
{
  "error": {
    "message": "Book not found",
    "code": "NOT_FOUND"
  }
}
```

## Regular Maintenance Checklist

### Weekly

- [ ] Check for updates
- [ ] Review import errors
- [ ] Clean up duplicates

### Monthly

- [ ] Export JSON backup
- [ ] Backup cover and ebook folders
- [ ] Review reading goals progress
- [ ] Check disk space

### Yearly

- [ ] Archive old logs
- [ ] Review and clean old backups
- [ ] Update metadata for old books
- [ ] Rebuild search index

## Support Resources

- **Documentation:** [https://yourusername.github.io/BookShelfV2](https://yourusername.github.io/BookShelfV2)
- **GitHub Issues:** [Report bugs](https://github.com/yourusername/BookShelfV2/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/yourusername/BookShelfV2/discussions)
- **Changelog:** Check `docs/CHANGELOG.md` for updates
- **Roadmap:** See `docs/ROADMAP.md` for planned features

---

**Can't find what you need?** Check the [FAQ](faq.html) or [User Guide](user-guide/).
