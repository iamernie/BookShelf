---
layout: default
title: FAQ
nav_order: 5
---

# Frequently Asked Questions
{: .no_toc }

Common questions and answers about BookShelf.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## General

### What is BookShelf?

BookShelf is a self-hosted web application for managing your personal book library. It helps you organize books, track reading progress, and read ebooks—all from your own server.

### Why self-host instead of using Goodreads?

**Benefits of self-hosting:**
- **Privacy** - Your data stays on your server
- **Control** - Customize features and appearance
- **No ads** - Clean interface without distractions
- **Ebook reader** - Read books directly in app
- **OPDS support** - Connect your e-reader devices
- **Offline access** - Works on your local network

You can still import from Goodreads and keep both!

### Is it free?

Yes! BookShelf is open source and released under the MIT License. You only pay for hosting (your own server or cloud provider).

### What's the difference between V1 and V2?

V2 is a complete rewrite with:
- Modern tech stack (SvelteKit, TypeScript)
- Better performance and UX
- Smart Collections (Magic Shelves)
- Enhanced ebook reader
- Improved statistics and heatmap
- Cleaner, more intuitive interface

V1 databases can be migrated to V2.

## Installation & Setup

### What are the system requirements?

**Minimal:**
- 512MB RAM
- 1GB storage (plus space for ebooks)
- Docker support (recommended)

**Recommended:**
- 1GB+ RAM
- 10GB+ storage
- Linux server (Raspberry Pi 4 works great!)

### Can I run it on a Raspberry Pi?

Yes! BookShelf runs well on Raspberry Pi 3B+ or newer. Use the Docker image for easy setup.

### Do I need a domain name?

No, you can access via:
- `http://localhost:3000` (local machine)
- `http://192.168.x.x:3000` (LAN IP)
- Port forward for internet access (not recommended without HTTPS)

A domain makes setup cleaner but isn't required.

### How do I enable HTTPS?

Use a reverse proxy like:
- **Nginx Proxy Manager** (easiest, GUI-based)
- **Traefik** (Docker-native)
- **Caddy** (auto HTTPS with Let's Encrypt)

See [Getting Started](getting-started.html#reverse-proxy-setup) for examples.

### Can I access it from outside my home?

Yes, options include:
1. **Port forwarding** (with HTTPS!)
2. **VPN** (Tailscale, WireGuard) - more secure
3. **Cloudflare Tunnel** - no port forwarding needed
4. **Cloud hosting** (DigitalOcean, AWS, etc.)

**Important:** Don't expose port 3000 directly to internet without HTTPS!

## Using BookShelf

### How do I add books?

Multiple ways:
1. **Manual entry** - Fill out form
2. **ISBN lookup** - Automatically fetch metadata
3. **CSV import** - From Goodreads or spreadsheet
4. **Audible import** - From library HTML export
5. **BookDrop** - Drop ebook files in folder for auto-import

### Can I import from Goodreads?

Yes! Export your Goodreads library as CSV, then use Import feature. Ratings, shelves (as tags), and read dates are preserved.

### What ebook formats are supported?

- **EPUB** - Reflowable ebooks (best supported)
- **PDF** - Documents and fixed-layout books
- **CBZ/CBR** - Comic books and manga

### Can I read books on my e-reader?

Yes, via OPDS catalog! Most e-reader apps (Calibre, KOReader, Moon+ Reader, FBReader) support OPDS and can connect to your BookShelf.

### How do Smart Collections work?

Smart Collections (Magic Shelves) are dynamic - they auto-update based on rules you set.

**Example:** "5-Star Sci-Fi"
- Genre = Science Fiction
- Rating = 5 stars
- Sort by: Date Read

Any book matching these conditions appears automatically.

### Can multiple people use one instance?

Yes! BookShelf supports multiple users with separate libraries or a shared library. Admin users manage the system while members manage their books.

### Does it work offline?

Yes, once loaded in browser. Reading ebooks works offline. Adding/editing books requires the server to be running.

## Troubleshooting

### I forgot my admin password

Reset via command line:

```bash
# Docker
docker exec -it bookshelf npm run reset-password admin

# Manual installation
npm run reset-password admin
```

Enter new password when prompted.

### Books aren't showing up after import

**Check:**
1. Import completed successfully (check notifications)
2. No filters applied (clear all filters)
3. Try different sort order
4. Check Admin → Data Cleanup for issues

### Covers not downloading

**Possible causes:**
- Network issue (check internet connection)
- API rate limits (wait and retry)
- Provider is down (try different provider)
- Invalid ISBN (verify ISBN is correct)

**Solution:**
- Admin → Settings → Metadata Providers
- Enable multiple providers
- Try manual cover upload as fallback

### Ebook won't open in reader

**Check:**
1. File format is supported (EPUB, PDF, CBZ)
2. File isn't corrupted (try opening in another app)
3. File uploaded completely (check file size)
4. Browser JavaScript is enabled

**Try:**
- Re-upload the file
- Try different browser
- Check browser console for errors

### Search not finding books

**Solutions:**
1. Admin → Settings → Advanced → **Rebuild Search Index**
2. Check spelling (search is exact match)
3. Try partial title or author name
4. Use filters instead of search

### Database error after update

Migrations should run automatically. If not:

```bash
# Docker
docker exec -it bookshelf npm run db:migrate

# Manual
npm run db:migrate
```

**If that fails:**
1. Restore from backup
2. Check logs for specific error
3. Report issue on GitHub

### Permission errors in Docker

**Issue:** Can't write files, database locked, etc.

**Solution:**
- Set PUID/PGID to match your user:
```bash
id -u  # Your UID
id -g  # Your GID
```
- Update `.env` file:
```env
PUID=1000
PGID=1000
```
- Restart: `docker compose restart`

### High memory usage

**Normal:** 100-300MB for small libraries (<1000 books)

**If higher:**
1. Check for large PDF files open in reader
2. Restart container: `docker compose restart`
3. Reduce cover cache size in settings
4. Close unused browser tabs

## Features & Functionality

### Can I track audiobooks?

Yes! Set format to "Audiobook" and optionally add narrator. Reading time tracking works for time spent in app.

### Can I export my data?

Yes! Multiple formats:
- **CSV** - For spreadsheets or other apps
- **JSON** - Complete backup with all metadata
- **Database file** - SQLite file for direct access

### Can I customize genres and tags?

Yes! Create custom genres with colors and icons. Create unlimited tags for flexible organization.

### How are "similar books" determined?

Based on:
1. Shared authors
2. Same series
3. Common genres
4. Matching tags

AI recommendations (optional, requires OpenAI API key) provide more advanced suggestions.

### Can I track re-reads?

Yes! Enable re-read counting in settings. Each completion is logged separately in reading history.

### What are reading goals vs challenges?

Same thing! "Challenges" are specific types of goals (genre challenge, author challenge, etc.).

### Can I have private and public books?

Coming soon! Currently all books are visible to authenticated users. Public library feature allows showing specific books without login.

## Data & Privacy

### Where is my data stored?

Everything is stored locally on your server:
- **Database:** SQLite file in `/data`
- **Covers:** `/app/static/covers`
- **Ebooks:** `/app/static/ebooks`
- **Logs:** `/logs`

Nothing is sent to external servers except:
- Metadata lookups (when you explicitly fetch)
- AI recommendations (if you enable OpenAI)

### Can others see my library?

Only if you:
1. Enable "Public Library" in settings
2. Share OPDS catalog publicly
3. Enable public widgets

By default, login is required.

### How do I backup my data?

**Regularly:**
- Export → JSON backup (includes metadata)
- Copy database file
- Backup cover and ebook folders

**Automated:**
- Set up cron job to backup database
- Use Docker volume backups
- Sync to cloud storage (Dropbox, Google Drive)

See [Import & Export](user-guide/import-export.html#scheduled-backups) for scripts.

### Can I migrate to another server?

Yes! BookShelf is portable:

1. Export JSON backup
2. Copy ebook and cover folders
3. Install BookShelf on new server
4. Import JSON backup
5. Copy ebook and cover folders to new location

## Development & Contributing

### Can I contribute?

Yes! BookShelf is open source. Contributions welcome:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation
- Translate to other languages

See `CONTRIBUTING.md` in the repository.

### How do I report a bug?

[Open an issue on GitHub](https://github.com/yourusername/BookShelfV2/issues) with:
- BookShelf version
- Environment (Docker, manual, OS)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### How do I request a feature?

[Open a feature request](https://github.com/yourusername/BookShelfV2/issues) describing:
- What you want to do
- Why it would be useful
- How you imagine it working

Check existing issues first to avoid duplicates!

### Where can I get help?

- **Documentation:** You're reading it!
- **GitHub Issues:** For bugs and feature requests
- **GitHub Discussions:** For questions and community help
- **Discord** (coming soon): Real-time chat

## Miscellaneous

### Why "BookShelf" not "Bookshelf"?

Because it's a shelf for books! The capital S makes it feel like a proper name. 😊

### Will you add [feature]?

Check the [Roadmap](https://github.com/yourusername/BookShelfV2/blob/main/docs/ROADMAP.md) for planned features. If it's not there, open a feature request!

### Can I use this commercially?

Yes, MIT License allows commercial use. Attribution appreciated but not required.

### Is there a mobile app?

Not yet, but the web interface is fully responsive and works great on mobile browsers. Add to home screen for app-like experience!

**Mobile Apps (future):**
- Native iOS/Android apps are on the roadmap
- OPDS support means your existing e-reader apps work now

### Can I change the name/logo?

Yes! Admin → Settings → Branding. Upload custom logos and set library name.

### Does it support multiple languages?

Currently English only. Internationalization (i18n) is planned. Contributions welcome!

### What's next for BookShelf?

See the [Roadmap](https://github.com/yourusername/BookShelfV2/blob/main/docs/ROADMAP.md) for upcoming features like:
- Mobile apps
- Book clubs and social features
- Advanced cataloging (KOReader sync)
- Reading analytics
- And more!

---

**Still have questions?** Open a [discussion on GitHub](https://github.com/yourusername/BookShelfV2/discussions) or check the [User Guide](user-guide/).
