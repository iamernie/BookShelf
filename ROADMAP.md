# BookShelf Roadmap

This document outlines planned features, improvements, and future direction for BookShelf.

## Completed

### Core Features
- [x] Book management (CRUD, search, filters, bulk operations)
- [x] Author management with Wikipedia metadata import
- [x] Series management with book ordering and gap tracking
- [x] Genre, format, narrator, and tag management
- [x] Reading status tracking with DNF support
- [x] Reading goals and challenges
- [x] Statistics and analytics dashboard
- [x] Cover image handling (upload, auto-download)

### User System
- [x] Multi-user authentication
- [x] Role-based access (admin, member)
- [x] Email verification for signups
- [x] Password reset via email
- [x] Invite codes for controlled registration
- [x] Admin approval workflow
- [x] **OIDC/SSO authentication** (Authentik, Keycloak, Google, GitHub, etc.)
- [x] Account linking for OIDC providers
- [x] **SMTP/Email settings in UI** - Configure email via settings page or environment variables

### Import/Export
- [x] CSV export (books, authors, series)
- [x] CSV import (Goodreads format)
- [x] JSON full backup and restore
- [x] Audible HTML library import

### Ebook Features
- [x] EPUB reader with progress persistence
- [x] PDF viewer
- [x] CBZ comic reader
- [x] Metadata extraction from EPUB files
- [x] File naming patterns for organization
- [ ] **MOBI format support** - Convert MOBI → EPUB on upload using Calibre
  - Add Calibre to Docker image
  - Auto-convert MOBI files on upload
  - Extract metadata during conversion
  - Store as EPUB internally for reading

### Other
- [x] OPDS catalog feed
- [x] Dark mode
- [x] Mobile-responsive design
- [x] Public widgets (embeddable)
- [x] API documentation (Swagger UI)
- [x] Database migration system with automatic backups
- [x] Upgrade progress page for V1 to V2 migrations
- [x] **Tabbed settings page** - Cleaner admin settings with organized tabs
- [x] **Collapsible admin sidebar** - Better navigation for admin users
- [x] **AI-powered recommendations** - Book suggestions based on reading history and preferences
- [x] **Customizable dashboard** - Toggle, reorder, and configure dashboard sections
- [x] **Kobo Device Sync** - Sync your BookShelf library directly to Kobo e-readers
  - Tag-based sync: Add "kobo" tag to books you want on your device
  - Bidirectional reading progress sync
  - Kobo Store proxy for purchased books
  - Detailed setup instructions in user settings
  - Drag-and-drop section reordering
  - Show/hide individual sections (Reading Goal, Continue Reading, Up Next, Recently Added, Recently Completed)
  - Smart Collection section to display any Magic Shelf on the dashboard
  - Settings persist per user
- [x] **Mobile reader improvements** - Fixed ebook and audiobook playback on mobile devices
  - Touch navigation zones for ebook reader
  - Autoplay restriction handling for audio player
- [x] **Author Tags** - Authors support tagging just like books and series
- [x] **Enhanced Tag Visibility** - More tags shown on cards, clickable filters, color-coded display
- [x] **Inline Tag Editor** - Edit tags directly on detail pages without entering edit mode
- [x] **Dynamic Date Filters** - Use "Today" as a relative date value in smart collection rules
- [x] **Inline Rating & Status** - Edit book rating and status directly on detail page without entering edit mode
- [x] **Enhanced Narrator System** - Narrators match author experience with tags, Wikipedia search, detail pages, and extended metadata fields
- [x] **Inline Entity Creation** - Create authors, series, narrators, and genres directly from book add/edit forms without leaving the page
- [x] **Bulk Edit Fixes** - Fixed bulk edit operations for series and authors in the action bar
- [x] **ntfy Push Notifications** - Real-time push notifications via ntfy
  - Admin settings for ntfy server URL and admin topic
  - Per-user notification topics and event preferences
  - Notifications for: book added, book completed, series completed, goal reached
  - Test notification button in both admin and user settings

### Security (v2.3.3)
- [x] Secure session cookies (`secure: true` in production)
- [x] Admin-only settings API access
- [x] Updated vulnerable dependencies (multer)

---

## In Progress

### Per-User Personal Libraries (Multi-Library Support)
- [x] Add `ownerId` to books table for book ownership
- [x] Create `library_shares` table for sharing between users
- [x] Database migration (assign existing books to admin user)
- [x] Create libraryShareService for sharing management
- [x] Update bookService with ownership filtering
- [x] Update dashboardService to include shared books
- [x] Update searchService to filter by accessible books
- [x] Update API routes with userId context and permissions
- [x] Add permission check to ebook serving route
- [x] Library sharing API endpoints
- [x] Unified "Add to Library" page (`/library/add`)
  - Auto-detects file type (ebook vs audiobook)
  - Metadata extraction from uploaded files
  - Metadata search from online databases
  - Public library requires file attachment
  - Personal library allows tracking-only entries
- [x] Public library support for audiobooks
  - `libraryType` column on audiobooks table
  - `userAudiobooks` junction table for personal library entries
- [ ] Library sharing UI in user settings
- [ ] Permission levels: read, read_write, full

**Goal:** Each user has their own private book collection.

### Security Hardening (see [security-recommendations.md](security-recommendations.md))
- [x] Rate limiting on auth endpoints (password reset, login, signup)
- [x] Path traversal hardening (proper path resolution)
- [x] SSRF protection for cover downloads
- [x] Remove debug logging of sensitive data
- [x] Add security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] File content validation (magic numbers)
- [ ] Encrypt database backups

Users can optionally share their library with other users (e.g., family members in the same household). New users start with 0 books.

---

## Planned

### Short Term
- [ ] Barcode/ISBN scanner (mobile camera)
- [ ] Public landing page (optional)
- [x] "What's New" changelog modal - Shows latest changes after updates (admin only)
- [x] **Data Cleanup Tool** - Find and merge duplicate authors, series, and books
  - Admin page at `/admin/data-cleanup`
  - Detects duplicates using normalized string matching
  - Merge functionality preserves all relationships

### Medium Term
- [ ] Reading analytics (time tracking, pace)
- [ ] Book club features (shared lists, discussions)
- [ ] Wishlist with price tracking
- [ ] Goodreads sync (two-way)
- [ ] Custom fields for books

### Long Term
- [x] Progressive Web App (PWA) - Installable, offline support, app-like experience
- [ ] Social features (follow users, public profiles)
- [ ] Plugin/extension system

---

## Audiobooks

The built-in audiobook upload and player was removed in v2.12.0. Audiobooks are now handled by an [Audiobookshelf](https://www.audiobookshelf.org) server through the Audiobookshelf integration (Admin → Settings → Integrations): BookShelf links books to Audiobookshelf items, syncs new audiobooks into the library, and shows a **Listen on Audiobookshelf** button on linked books.

---

## Planned

### API Documentation Enhancements
- [x] Basic Swagger UI at `/api-explorer`
- [ ] Expand API documentation coverage
  - Document all endpoints with request/response schemas
  - Add authentication documentation
  - Include example requests and responses
  - Group endpoints by category (books, authors, series, audiobooks, etc.)
- [ ] Interactive API testing
  - "Try it out" functionality with authentication
  - Download OpenAPI spec

---

## Ideas / Under Consideration

- LibraryThing import
- Kindle sync
- Read-aloud (TTS) for ebooks
- Book lending tracker
- Series completion notifications
- Reading streaks and achievements
- Integration with local library catalogs
- Book recommendations from friends
- Collaborative reading lists

---

## Contributing

Have a feature request? Open an issue on GitHub with the `enhancement` label.
