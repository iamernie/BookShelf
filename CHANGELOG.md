# Changelog

All notable changes to BookShelf V2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
