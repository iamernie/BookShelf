# BookShelf V2 Roadmap

This document outlines planned features, improvements, and future direction for BookShelf V2.

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
- [ ] Rate limiting on password reset
- [ ] Path traversal hardening (proper path resolution)
- [ ] SSRF protection for cover downloads
- [ ] Remove debug logging of sensitive data
- [ ] Add security headers (CSP, HSTS, X-Frame-Options)
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

## Audiobook Support (Inspired by Audiobookshelf)

A comprehensive audiobook playback system integrated into BookShelf V2, allowing users to upload, manage, and play audiobooks directly in the browser with progress sync across devices.

**Key Design Decision:** Audiobooks are attached to books, not standalone items. The book is the single source of truth for all metadata (title, author, series, etc.). This unified approach means you manage one book entry whether you have an ebook, audiobook, or both.

### Phase 1: MVP - Basic Audiobook Playback ✅ COMPLETE
**Goal:** Upload audiobooks and play them with basic controls and progress tracking.

#### Database Schema ✅
- [x] Create `audiobooks` table
  - `id`, `bookId` (link to existing book), `userId` (owner)
  - `title`, `author`, `narrator`, `duration` (total seconds)
  - `coverPath`, `description`
  - `createdAt`, `updatedAt`
- [x] Create `audiobook_files` table (multi-file support)
  - `id`, `audiobookId`, `filename`, `filePath`
  - `duration` (seconds), `fileSize`, `mimeType`
  - `trackNumber`, `title` (chapter/track name)
  - `startOffset` (cumulative offset for seeking)
- [x] Create `audiobook_progress` table
  - `id`, `audiobookId`, `userId`
  - `currentTime` (seconds), `currentFileId`
  - `duration`, `progress` (0-1), `playbackRate`
  - `isFinished`, `finishedAt`
  - `lastPlayedAt`, `updatedAt`

#### Backend Services ✅
- [x] Create `audiobookService.ts`
  - CRUD for audiobooks
  - File management (upload, delete)
  - Progress tracking API
  - Duration calculation from audio files
- [x] Create audio file upload endpoint
  - Accept MP3, M4A, M4B, AAC, OGG, OPUS, FLAC, WAV formats
  - Store in `/data/audiobooks/{userId}/{audiobookId}/`
  - Extract duration using music-metadata library
- [x] Create streaming endpoint `/api/audiobooks/[id]/stream/[fileId]`
  - Support HTTP Range requests for seeking
  - Proper MIME types (audio/mpeg, audio/mp4, audio/x-m4b)
- [x] Create progress sync endpoints
  - `POST /api/audiobooks/[id]/progress` - update position
  - `GET /api/audiobooks/[id]/progress` - get current position

#### Frontend Components ✅
- [x] Create `AudioPlayer.svelte` component
  - HTML5 `<audio>` element with custom controls
  - Play/Pause button
  - Progress bar with seek functionality
  - Current time / Total duration display
  - Volume control
  - Playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
- [x] Create audiobook library page `/audiobooks`
  - Grid/list view of audiobooks
  - Show progress percentage
  - Filter by status (in progress, completed, not started)
  - Continue Listening section
- [x] Create audiobook detail page `/audiobooks/[id]`
  - Cover, title, author, narrator, duration
  - Track/file listing with playback
  - Play button, continue listening
  - Progress indicator

#### Book Integration ✅
- [x] Unified "Media" tab on book edit page
  - Upload ebook and/or audiobook files from one place
  - Book is the source of truth for metadata
  - Audiobook inherits title, author, series from book
- [x] Book detail page Media tab
  - Shows both ebook and linked audiobooks
  - Quick access to Read (ebook) and Listen (audiobook)
  - Progress tracking for audiobooks
- [x] **Embedded Listen tab on book detail page**
  - Full audio player embedded directly in book page
  - No separate audiobook detail page needed
  - Track list with file metadata (format, size, duration)
  - Progress bar with remaining time display
  - Mark Finished and Reset progress buttons
  - Bookmarks display
  - `/audiobooks/[id]` redirects to `/books/[bookId]?listen=true`
- [x] Redirect standalone audiobook upload to book edit page
  - `/audiobooks/upload` guides users to create/find a book first
  - `/audiobooks/upload?bookId=X` redirects to `/books/X/edit?tab=media`

#### Multi-Track Support ✅
- [x] Handle audiobooks with multiple MP3 files
  - Auto-advance to next track on completion
  - Seamless playback between tracks
  - Track `currentFileId` and offset for accurate seeking
- [x] Support single-file M4B audiobooks
  - Direct play without track management

### Phase 2: Enhanced Player Features ✅ COMPLETE
**Goal:** Add advanced playback features for a better listening experience.

- [x] Sleep timer
  - Set timer (15min, 30min, 45min, 1hr, end of chapter)
  - Gradual volume fade before stop
  - Visual countdown in player
- [x] Bookmarks
  - Save position with optional note
  - List and navigate to bookmarks
  - Quick bookmark button in player
- [x] Keyboard shortcuts
  - Space: play/pause
  - Left/Right arrows: skip 10s/30s
  - Up/Down arrows: volume
  - [ / ]: playback speed
- [x] Audiobook completion tracking
  - Auto-mark as finished at 95% progress
  - Syncs status to linked book (marks as READ)
  - Syncs to userAudiobooks library entry
- [x] "Has Audiobook" smart collection filter
  - Filter books by whether they have linked audiobooks
- [x] Chapter support
  - Parse chapter markers from M4B metadata
  - Automatic chapter creation from multi-file audiobooks (track titles)
  - Chapter navigation in player UI (prev/next buttons, chapter list)
  - Display current chapter name in player
  - Keyboard shortcuts: C to toggle chapters, comma/period for prev/next
  - API endpoint for chapter management
- [ ] Skip silence (optional)
  - Detect and skip silent portions
  - Configurable threshold

### Phase 3: Library & Metadata
**Goal:** Rich library management and metadata support.

- [x] Link audiobooks to existing books ✅ (Core feature - audiobooks always linked to books)
  - Associate audiobook with book record
  - Show audiobook availability on book page
  - Unified reading/listening progress
- [x] Duplicate detection on upload
  - Fuzzy title matching when adding new books
  - Detects when audiobook file matches existing book (e.g., "Edge World: Undying Mercenaries, Book 14" → "Edge World")
  - Option to link file to existing book instead of creating duplicate
  - Visual warning with match percentage
- [ ] Metadata lookup
  - Audible metadata search
  - Audnexus API for chapters
  - Cover art from multiple sources
- [x] Narrator management ✅ (Existing narrator system works with audiobooks)
  - Link to existing narrators table
  - Narrator page with audiobook list
- [x] Series support for audiobooks ✅ (Inherited from book's series)
  - Group audiobooks by series
  - Series progress tracking
- [ ] Import from folder
  - Scan folder for audiobook files
  - Auto-detect book structure
  - Batch import with metadata matching

### Phase 4: Advanced Features (Future)
**Goal:** Power user features and integrations.

- [ ] HLS transcoding for incompatible formats
  - FFmpeg integration for FLAC, OGG, etc.
  - On-the-fly transcoding to AAC
  - Segment caching for performance
- [ ] Chromecast support
  - Cast to TV/speakers
  - Remote control from browser
- [ ] CarPlay/Android Auto metadata
  - Proper metadata for car displays
- [x] Offline PWA support
  - Service worker caching for static assets
  - Installable as home screen app
  - [ ] Download audiobooks for offline (future)
  - [ ] Background sync of progress (future)
- [ ] Podcast support
  - RSS feed subscription
  - Auto-download new episodes
  - Episode management

---

### Technical Notes

**Inspired by Audiobookshelf architecture:**
- Direct play for browser-compatible formats (MP3, M4A, M4B, AAC)
- HLS transcoding only when needed (Phase 4)
- Progress sync similar to their `MediaProgress` model
- Multi-file support with `startOffset` tracking like their `LocalAudioPlayer.js`

**Key dependencies to add:**
- `music-metadata` - Extract duration and metadata from audio files
- `hls.js` - HLS playback support (Phase 4)

**File storage structure:**
```
/audiobooks/
  /{userId}/
    /{audiobookId}/
      cover.jpg
      01-chapter-1.mp3
      02-chapter-2.mp3
      ...
```

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
