# BookShelf V2 - Completed Features Changelog

This document details all completed features with their implementation specifics.

---

## Per-User Personal Libraries (Completed)

Multi-user private book collections with library sharing between users.

### Core Features

**Per-User Book Ownership:**
- Each user has their own private book collection
- New users start with 0 books (no shared global library)
- Books are owned by the user who creates/imports them
- All book operations respect ownership

**Library Sharing:**
- Share your library with other users (family, friends)
- Three permission levels:
  - `read` - View books and download ebooks
  - `read_write` - Add/edit books (no delete)
  - `full` - Complete access including delete
- Change or revoke permissions anytime

### Database Changes

**Schema (`src/lib/server/db/schema.ts`):**
- Added `ownerId` column to `books` table
- Created `library_shares` table with:
  - `ownerId` - User sharing their library
  - `sharedWithId` - User receiving access
  - `permission` - Access level (read/read_write/full)
  - Timestamps for created/updated

**Migration (`src/lib/server/db/index.ts`):**
- Adds `ownerId` column to existing books
- Assigns all existing books to admin user (id=1)
- Creates `library_shares` table with indexes

### Files Created

**Service (`src/lib/server/services/libraryShareService.ts`):**
- `shareLibrary(ownerId, sharedWithId, permission)` - Create a share
- `removeShare(ownerId, sharedWithId)` - Remove a share
- `getLibraryShares(ownerId)` - Get users you've shared with
- `getSharedLibraries(userId)` - Get libraries shared with you
- `getShareableUsers(userId)` - Get users available to share with
- `updateSharePermission()` - Change permission level
- `canAccessBook(userId, bookId)` - Check read access
- `canModifyBook(userId, bookId)` - Check edit access
- `canDeleteBook(userId, bookId)` - Check delete access
- `getAccessibleBookOwners(userId)` - Get all owner IDs user can access

**API Endpoints (`src/routes/api/library/shares/`):**
- `GET /api/library/shares` - List shares (type=my_shares or shared_with_me)
- `POST /api/library/shares` - Create new share
- `PUT /api/library/shares` - Update share permission
- `DELETE /api/library/shares?userId=X` - Remove share
- `GET /api/library/shares/users` - Get shareable users

### Files Modified

**Book Service (`src/lib/server/services/bookService.ts`):**
- `getBooks()` now filters by accessible owner IDs
- `createBook()` requires ownerId parameter
- Added `includeShared` option to include shared libraries

**Dashboard Service (`src/lib/server/services/dashboardService.ts`):**
- All stats filtered by user's accessible libraries
- `getUserLibraryCondition()` now async for permission lookups

**Search Service (`src/lib/server/services/searchService.ts`):**
- Search results filtered to accessible books only

**API Routes:**
- `GET /api/books` - Filters by user's library
- `POST /api/books` - Sets ownerId to current user
- `PUT /api/books/[id]` - Checks modify permission
- `DELETE /api/books/[id]` - Checks delete permission
- `GET /ebooks/[...path]` - Checks ebook access permission

### UI Features (`/account/settings`)

**Library Sharing Section:**
- Shows users you've shared your library with
- Shows libraries shared with you
- Permission level indicator (icons + labels)
- Change permission dropdown
- Remove share button with confirmation
- Empty state with helpful message

**Share Library Modal:**
- User selection dropdown (only shows available users)
- Permission level picker with descriptions:
  - View Only (read)
  - Can Edit (read_write)
  - Full Access (full)
- Share button creates the share

---

## AI Recommendations (Completed)

OpenAI-powered book suggestions based on your reading history, plus rule-based recommendations.

### AI-Powered Recommendations

**Features:**
- Integration with OpenAI API (GPT-3.5 Turbo, GPT-4, GPT-4 Turbo)
- Personalized recommendations based on your library
- Analyzes up to 50 books (genres, authors, read dates, ratings)
- Shows reasoning for each recommendation
- Checks if suggested books already exist in library
- Add recommendations directly to wishlist
- Google search lookup for unfamiliar books
- Configurable API key and model selection

**Settings:**
- Enable/disable AI recommendations
- API key management with secure storage
- Model selection (gpt-3.5-turbo, gpt-4, gpt-4-turbo)
- Connection test functionality

### Rule-Based Recommendations

**Types:**
- **Series Continuation** - Next unread book in series you're reading
- **Author Exploration** - Unread books by authors you've rated highly
- **Genre Discovery** - Books in genres you read frequently

### Files Created

**Service (`src/lib/server/services/recommendationService.ts`):**
- `getAISettings()` - Retrieve AI configuration
- `saveAISettings()` - Store API key and model
- `testAIConnection()` - Verify API key works
- `getAIRecommendations()` - Get AI suggestions with library analysis
- `getRuleBasedRecommendations()` - Get algorithmic suggestions
- `addRecommendationToLibrary()` - Add suggestion as wishlist book

**API Endpoints:**
- `src/routes/api/recommendations/+server.ts` - GET rule-based recommendations
- `src/routes/api/recommendations/ai/+server.ts` - GET AI recommendations, POST add to library
- `src/routes/api/recommendations/ai/settings/+server.ts` - GET/PUT AI settings, POST test connection

**UI:**
- `src/routes/recommendations/+page.svelte` - Recommendations page with AI and rule-based sections
- `src/routes/recommendations/+page.server.ts` - Page data loader

### UI Features

- Gradient AI section (purple/indigo) with sparkle icon
- Refresh button to regenerate AI recommendations
- "Powered by [model] • Based on X books" indicator
- Per-recommendation action buttons: Add to Wishlist, Look Up
- "In Library" badge for books already owned
- Rule-based sections with series/author/genre icons
- Book cards with covers, titles, authors, series info

---

## Public Widgets (Completed)

Embeddable reading widgets for blogs and external websites, matching V1 functionality.

### Widget Types

| Type | Description | Options |
|------|-------------|---------|
| **Currently Reading** | Books you're actively reading | Limit (3, 5, 10) |
| **Recent Reads** | Recently completed books with ratings | Limit (3, 5, 10) |
| **Reading Stats** | Overview statistics (total, read, this year, avg rating) | - |
| **Reading Goal** | Yearly goal progress with visual ring | - |

### Security

- Token-based authentication (32-character secure random token)
- Enable/disable toggle for all widgets
- Token regeneration with confirmation dialog
- Public paths don't require login session

### Embed Options

- **Theme**: Light or Dark
- **Size**: Customizable width and height
- **Limit**: Number of books for list widgets
- **Output**: iframe embed code or JSON API URL

### Files Created

**Service (`src/lib/server/services/widgetService.ts`):**
- `getWidgetToken()` - Get or create widget token
- `regenerateWidgetToken()` - Generate new token
- `validateWidgetToken()` - Verify token validity
- `areWidgetsEnabled()` - Check if widgets are enabled
- `setWidgetsEnabled()` - Toggle widget access
- `getCurrentlyReading()` - Get currently reading books
- `getRecentReads()` - Get recently completed books
- `getWidgetStats()` - Get library statistics
- `getWidgetGoal()` - Get reading goal progress
- `getWidgetData()` - Unified data fetcher by type

**API Endpoints:**
- `src/routes/widgets/api/[type]/+server.ts` - JSON data endpoint
- `src/routes/widgets/embed/+server.ts` - HTML embed endpoint

**Admin Page:**
- `src/routes/admin/widgets/+page.svelte` - Widget management UI
- `src/routes/admin/widgets/+page.server.ts` - Page data and form actions

### Widget Embed Features

- Self-contained HTML with inline CSS
- SVG icons for visual appeal
- Book covers with fallback placeholder
- Star ratings display
- Series and author information
- Progress ring for goals (SVG with animation)
- Responsive design within iframe
- No external dependencies

### API Response Format

```typescript
// JSON API response
{
  books: [{ title, author, coverUrl, series, bookNum, rating }],
  stats: { totalBooks, booksRead, booksThisYear, avgRating, totalAuthors, completionPercent },
  goal: { current, target, percent, remaining }
}
```

### Embed Code Example

```html
<iframe
  src="https://your-bookshelf.com/widgets/embed?type=currently-reading&token=xxx&theme=dark&limit=5"
  width="400px"
  height="300px"
  style="border: none; border-radius: 8px;">
</iframe>
```

---

## Better Login Page & Password Reset (Completed)

Redesigned login page with logo, improved UX, and full password reset flow.

### Login Page Redesign

**Features:**
- Logo display with BookShelf branding
- Icon-enhanced input fields (email, password)
- Show/hide password toggle
- Gradient background styling
- Loading states with spinner
- "Forgot password?" link

### Password Reset Flow

Complete password reset system with email support.

**Features:**
- Forgot password form on login page
- Email-based reset with secure tokens
- 1-hour token expiration
- Reset password page with validation
- Password confirmation field
- Success confirmation with auto-redirect

**Email Service:**
- SMTP configuration via environment variables
- HTML email templates with responsive design
- Graceful degradation when SMTP not configured

**Files Created:**
- `src/lib/server/services/emailService.ts` - Nodemailer-based email service
- `src/routes/api/auth/forgot-password/+server.ts` - Request password reset
- `src/routes/api/auth/reset-password/+server.ts` - Validate token and reset password
- `src/routes/reset-password/+page.svelte` - Password reset UI
- `static/bookshelflogo.png` - Application logo (from V1)

**Files Modified:**
- `src/routes/login/+page.svelte` - Redesigned with logo and forgot password
- `src/lib/server/services/authService.ts` - Added reset token functions
- `src/hooks.server.ts` - Added reset-password to public paths

**Environment Variables (optional):**
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user
SMTP_PASS=password
SMTP_FROM=BookShelf <noreply@example.com>
```

---

## Setup Wizard & System Diagnostics (Completed)

Added first-run setup wizard for Docker deployments and comprehensive system diagnostics with repair tools.

### Setup Wizard

Multi-step wizard that appears on first run when no users exist in the database.

**Features:**
- Welcome screen with feature highlights
- Automatic database connection verification
- Admin account creation with validation
- Completion screen with redirect to login
- Automatic detection via SvelteKit hooks

**Files Created:**
- `src/lib/server/services/setupService.ts` - Setup logic (check status, create admin, initialize defaults)
- `src/routes/setup/+page.svelte` - Multi-step wizard UI
- `src/routes/setup/+page.server.ts` - Page data loader with redirect if setup complete
- `src/routes/api/setup/+server.ts` - GET status check, POST complete setup

**Files Modified:**
- `src/hooks.server.ts` - Added setup check and redirect to `/setup` when needed

### System Diagnostics

Admin-only diagnostics page for monitoring system health and repairing database issues.

**Features:**
- System status overview (healthy/warning/error)
- Database information (size, path, connection)
- Storage usage (covers and ebooks counts/sizes)
- Data summary counts (books, authors, series, genres, users, sessions)
- Issue detection:
  - Orphaned book-author relationships
  - Orphaned book-series relationships
  - Orphaned book-tag relationships
  - Authors with no books
  - Series with no books
  - Tags not used by any books
  - Books with invalid genre/status references
  - Expired user sessions
- One-click repair for each issue type
- "Repair All" button for bulk fixes

**Files Created:**
- `src/lib/server/services/diagnosticService.ts` - Health checks and repair functions
- `src/routes/admin/diagnostics/+page.svelte` - Diagnostics UI
- `src/routes/admin/diagnostics/+page.server.ts` - Page data loader (admin only)
- `src/routes/api/admin/diagnostics/+server.ts` - GET diagnostics data
- `src/routes/api/admin/diagnostics/repair/+server.ts` - POST repair actions

**Repair Functions:**
- `repairOrphanedRelationships()` - Clean orphaned junction table entries
- `cleanExpiredSessions()` - Remove expired user sessions
- `fixInvalidBookReferences()` - Clear invalid foreign key references
- `removeOrphanedAuthors()` - Delete authors with no books
- `removeOrphanedSeries()` - Delete series with no books
- `removeOrphanedTags()` - Delete unused tags
- `runAllRepairs()` - Execute all repairs in sequence

---

## Amazon & ComicVine Metadata Providers (Completed)

Added two new metadata providers for enhanced book discovery and comic book support.

### Amazon Provider

Scrapes book metadata from Amazon's website (no API key required).

**Features:**
- Search by title, author, or ISBN
- Multi-region support (US, UK, DE, FR, IT, ES, CA, AU, JP, IN)
- Extracts: title, subtitle, authors, description, cover image, ISBN-10/13, ASIN
- Series information, page count, language, publisher
- Amazon ratings and review counts
- Rate-limited with caching to avoid blocks

**Files Created:**
- `src/lib/server/services/metadataProviders/amazonProvider.ts`

### ComicVine Provider

Fetches comic book metadata from ComicVine API (requires API key from https://comicvine.gamespot.com/api/).

**Features:**
- Search comic volumes and issues
- Extracts: title, description, cover images, series info
- Issue numbers, publication dates
- Writer/author credits from person_credits
- Publisher information

**Files Created:**
- `src/lib/server/services/metadataProviders/comicVineProvider.ts`

### Integration

Both providers are registered in the metadata provider registry and can be enabled in settings:
- Amazon: Disabled by default (web scraping may be unreliable)
- ComicVine: Disabled by default (requires API key)

Updated files:
- `src/lib/server/services/metadataProviders/types.ts` - Added 'amazon' | 'comicvine' to MetadataProvider type
- `src/lib/server/services/metadataProviders/index.ts` - Registered new providers with configuration options

---

## Reading Activity Heatmap (Completed)

GitHub-style reading activity visualization that tracks reading sessions and displays them as a yearly calendar heatmap.

### Features

- **Session Tracking**: Automatically tracks reading time when using any reader (EPUB, PDF, CBZ)
- **Yearly Heatmap**: Visual calendar showing daily reading activity intensity
- **Streak Tracking**: Displays current streak and longest streak
- **Statistics**: Total reading time, session count, and activity metrics
- **Year Navigation**: Browse heatmaps for previous years
- **Responsive Design**: Works on mobile with horizontal scroll

### Files Created

**Database:**
- `reading_sessions` table with bookId, userId, startedAt, endedAt, durationMinutes, progress tracking

**Services:**
- `src/lib/server/services/readingSessionService.ts` - Session CRUD, heatmap data aggregation, streak calculation

**Components:**
- `src/lib/components/stats/ReadingHeatmap.svelte` - Full heatmap visualization with tooltip and legend

**API Endpoints:**
- `src/routes/api/reading-sessions/+server.ts` - GET heatmap data, POST start session
- `src/routes/api/reading-sessions/[id]/+server.ts` - PATCH end session, DELETE session

### Integration

All three reader components (EPUB, PDF, CBZ) now automatically:
1. Start a reading session on mount
2. End the session on destroy/navigation away
3. Track progress percentage for each session

The heatmap is displayed prominently on the Statistics page, showing reading activity at a glance.

---

## PDF & CBZ Reader Support (Completed)

Extended the ebook reader to support PDF documents and CBZ comic archives, in addition to the existing EPUB support.

### Features

**PDF Reader:**
- PDF.js integration for rendering PDF documents
- Page navigation with prev/next buttons and keyboard shortcuts
- Zoom controls (50% - 300%)
- Page number input for direct navigation
- Progress bar with percentage display
- Responsive design with touch/swipe support
- Theme options (light/dark/sepia background)
- Automatic progress saving

**CBZ/Comic Reader:**
- JSZip-based CBZ extraction
- Single and double-page viewing modes
- Fit-to-width, fit-to-height, and fit-both options
- Natural page ordering (handles page1, page2, page10 correctly)
- Click-to-advance navigation (left third = back, right = forward)
- Image preloading for smooth navigation
- Progress tracking with page numbers

### Files Created

**Services:**
- `src/lib/server/services/cbzService.ts` - CBZ extraction and caching

**Components:**
- `src/lib/components/reader/PdfReader.svelte` - Full PDF reader UI
- `src/lib/components/reader/CbzReader.svelte` - Comic viewer UI

**API Endpoints:**
- `src/routes/api/cbz/[id]/metadata/+server.ts` - Get CBZ page count and metadata
- `src/routes/api/cbz/[id]/page/[page]/+server.ts` - Serve individual comic pages

**Static Assets:**
- `static/pdfjs/pdf.worker.mjs` - PDF.js web worker

### Usage

Users can now read PDF and CBZ files directly in the browser by navigating to any book with an attached PDF or CBZ file and clicking "Read". The reader automatically detects the format and uses the appropriate viewer.

---

## Enhanced Metadata Providers (Completed)

Multi-source book metadata lookup system inspired by BookLore, providing better cover images, descriptions, series info, and ratings.

### Supported Providers

| Provider | Type | Auth Required | Best For |
|----------|------|---------------|----------|
| Google Books | API | No | General metadata, official API |
| Open Library | API | No | Classic/older books, free covers |
| Goodreads | Scraping | No | Ratings, reviews, series info |
| Hardcover | GraphQL | API Key | Modern catalog, moods, tags |

### Features

- **Unified Search API**: `/api/metadata/search` - Search all enabled providers at once
- **Provider Configuration**: Enable/disable providers in Settings page
- **Caching**: 15-minute cache for API responses to reduce load
- **Rate Limiting**: 1-second delay for Goodreads to respect their limits
- **Result Scoring**: Automatic ranking by match quality

### Settings Integration

New "Metadata Providers" section in Settings page with toggles for:
- Google Books (enabled by default)
- Open Library (enabled by default)
- Goodreads (enabled by default)
- Hardcover (requires API key from hardcover.app/account/api)

### Files Created

**Types (`src/lib/server/services/metadataProviders/types.ts`):**
- `BookMetadataResult` - unified metadata result interface
- `MetadataProviderInterface` - base interface for all providers
- Helper functions: `normalizeIsbn`, `isValidIsbn`, `extractYear`, etc.

**Providers:**
- `googleBooksProvider.ts` - Google Books API integration
- `openLibraryProvider.ts` - Open Library API integration
- `goodreadsProvider.ts` - Goodreads page scraping with JSON extraction
- `hardcoverProvider.ts` - Hardcover GraphQL API integration

**Registry (`src/lib/server/services/metadataProviders/index.ts`):**
- `MetadataProviderRegistry` - manages all providers
- `searchAll()` - search all enabled providers in parallel
- `findBest()` - find best match across all providers

**API Endpoints:**
- `src/routes/api/metadata/search/+server.ts` - Search endpoint (GET & POST)
- `src/routes/api/metadata/providers/+server.ts` - List/configure providers
- `src/routes/api/metadata/[provider]/[id]/+server.ts` - Fetch details by ID

**Settings:**
- Added metadata provider settings to `settingsService.ts`
- Added `getMetadataProviderSettings()` helper function
- Updated Settings page with Metadata Providers category

### UI Integration

**MetadataSearchModal (`src/lib/components/book/MetadataSearchModal.svelte`):**
- Full-screen modal with search form and results preview
- Provider tabs showing results from each source with counts
- Result preview with cover image, title, authors, rating
- Field selection checkboxes to choose which data to apply
- Loads full details when a result is selected

**Book Edit Page (`src/routes/books/[id]/edit/+page.svelte`):**
- "Search Metadata Providers" button in Identifiers tab
- Opens MetadataSearchModal pre-filled with book's title/author/ISBN
- Applies selected fields and stores provider IDs (Goodreads/Google Books)

**BookModal (`src/lib/components/book/BookModal.svelte`):**
- Same metadata search integration for add/edit book modal
- Available in both "add new book" and "edit book" modes

### Bug Fixes

- **Goodreads Title Parsing** - Fixed search results showing "Untitled" instead of actual book titles. Updated regex patterns in `parseSearchResults()` to handle nested HTML elements and strip tags from title text.
- **Summary Display** - Summary now displays prominently on book view page in a styled card without requiring edit mode. Only shown when summary exists.

### API Usage Examples

```typescript
// Search by title
GET /api/metadata/search?q=The+Name+of+the+Wind

// Search by ISBN
GET /api/metadata/search?isbn=9780756404741

// Search specific provider
GET /api/metadata/search?q=mistborn&provider=goodreads

// Get details from a specific result
GET /api/metadata/goodreads/12345
```

---

## Reading Goals V1 Parity (Completed)

Enhanced reading goals system with full challenge types support, matching V1 functionality.

### Challenge Types

Six challenge types to track diverse reading goals:

| Type | Description | Unit | Default Target |
|------|-------------|------|----------------|
| Books | Read a target number of books | books | 12 |
| Genres | Read books from different genres | genres | 6 |
| Authors | Read books by different authors | authors | 12 |
| Formats | Read books in different formats | formats | 3 |
| Pages | Read a target number of pages | pages | 5000 |
| Monthly | Read consistently every month | months | 2 books/month |

### Goals Page Features

- Hero section showing main book count goal progress
- Monthly breakdown visualization (12-month grid)
- Challenge cards grid with individual progress tracking
- Add/edit/delete challenges with visual feedback
- Challenge type selection with descriptions
- Progress bars and completion badges
- Custom icon selection for challenges (40 Lucide icons available)
- Goals shortcut in top navbar

### Dashboard Integration

- Reading goal widget on dashboard homepage
- Shows main book goal progress with pace status
- Displays active challenges summary (up to 3)
- Link to full goals page

### Files Created/Modified

**Service (`src/lib/server/services/goalsService.ts`):**
- Added `CHALLENGE_TYPES` constant with all challenge definitions
- Added `GOAL_ICONS` constant with 40 available Lucide icon names
- Added `ChallengeType` and `ChallengeProgress` types
- Added progress calculation functions for each challenge type:
  - `calculateGenresProgress()` - distinct genres read
  - `calculateAuthorsProgress()` - distinct authors read
  - `calculateFormatsProgress()` - distinct formats read
  - `calculatePagesProgress()` - total pages read
  - `calculateMonthlyProgress()` - months meeting target
- Added `getChallengesForYear()` - get all challenges with progress
- Added `getGoalForDashboard()` - dashboard data formatter
- Added `createChallenge()` - create new challenge with type and icon

**Server (`src/routes/stats/goals/+page.server.ts`):**
- Added `challenges`, `challengeTypes`, and `goalIcons` to page data
- Added `createChallenge` form action with icon support
- Updated `updateGoal` to handle all challenge target fields and icon

**UI (`src/routes/stats/goals/+page.svelte`):**
- Added challenge cards section with progress visualization
- Added "Add Challenge" form with type and icon selection
- Added inline editing for challenge targets and icons
- Dynamic icon display using LucideIcon component

**Components:**
- Added `LucideIcon.svelte` - renders Lucide icons by name string
- Added `IconPicker.svelte` - searchable icon selection dropdown

**Layout (`src/lib/components/layout/TopNavbar.svelte`):**
- Added Goals shortcut icon (Target) next to Stats and Favorites

**Dashboard (`src/routes/+page.svelte` & `+page.server.ts`):**
- Added `getGoalForDashboard()` call to load data
- Added reading goal widget with main progress and challenges summary
- Added pace status indicators (ahead/behind/on track)

---

## Docker & GitHub Actions (Completed)

Added Docker containerization and GitHub Actions CI/CD pipeline for automated builds and deployment.

### Docker Setup

**Multi-stage Dockerfile:**
- Builder stage compiles SvelteKit application
- Production stage uses minimal Alpine image with only production dependencies
- PUID/PGID support for proper file ownership in containers
- Uses `su-exec` for running as non-root user
- Health check endpoint at `/health`

**docker-compose.yml (Production):**
- Pulls from GitHub Container Registry
- Named volumes for data persistence:
  - `bookshelf_data` - SQLite database
  - `bookshelf_logs` - Application logs
  - `bookshelf_covers` - Book cover images
  - `bookshelf_ebooks` - Ebook files
- Configurable via environment variables
- Health check with 30s interval

**docker-compose.test.yml (Development):**
- Builds from local source
- Uses bind mounts for easy testing
- Runs on port 6465 to avoid conflicts
- Debug logging enabled

### GitHub Actions

**docker-publish.yml Workflow:**
- Triggers on version tags (`v*.*.*`), releases, and manual dispatch
- Builds and pushes to GitHub Container Registry (GHCR)
- Semantic versioning tags (major, minor, patch, latest)
- GitHub Actions cache for faster builds

### Files Created

- `Dockerfile` - Multi-stage build for production
- `docker-compose.yml` - Production deployment config
- `docker-compose.test.yml` - Local testing config
- `docker-entrypoint.sh` - Permission handling entrypoint
- `.dockerignore` - Excludes unnecessary files from image
- `.github/workflows/docker-publish.yml` - CI/CD workflow
- `src/routes/health/+server.ts` - Health check endpoint
- `testing/docker/` - Local testing volume directories

### Files Modified

- `.env.example` - Added Docker-related variables (PUID, PGID, ORIGIN)

### Usage

**Production (from GHCR):**
```bash
docker-compose up -d
```

**Local Testing:**
```bash
docker-compose -f docker-compose.test.yml up --build
```

---

## Phase 6.2: Inline Series Notes from Book Page (Completed)

Added inline editable series notes to the book detail page. When viewing a book that belongs to a series, users can now view and edit series notes directly without navigating away.

### Features

- Series notes section appears below the series link on book detail page
- Click to edit notes inline with textarea
- Save/Cancel buttons for confirmation
- Updates the series record via existing API

### Implementation

**Files Modified:**
- `src/lib/server/services/bookService.ts`
  - Added `comments` field to series type in `BookWithRelations` interface
  - Added `comments: series.comments` to series query in both `getBooks()` and `getBookById()` functions

- `src/routes/books/[id]/+page.svelte`
  - Added `editingSeriesNotes`, `savingSeriesNotes`, `editSeriesNotesValue` state variables
  - Added `startEditSeriesNotes()`, `saveSeriesNotes()`, `cancelSeriesNotesEdit()` functions
  - Added series notes section UI with inline editing pattern (matches existing summary/notes pattern)
  - Notes displayed below each series link, indented to align with series content

### API Used

- `PUT /api/series/{id}` with `{ comments: "..." }` body

---

## Phase 5.3: Quick Edit, Date Formatting & Git Cleanup (Completed)

Improved UX with quick edit functionality, standardized date handling, and proper git exclusions.

### Quick Edit on BookCard

Hover over any book card to reveal a quick edit button. Click it to open an overlay for rapid rating and status changes without leaving the page.

**Features:**
- Pencil icon appears on hover (top-right of cover)
- Click to open overlay with:
  - 5-star rating picker (click to rate, hover preview)
  - Status buttons for quick status changes
  - Current rating and status highlighted
- Works on Dashboard and Books pages
- API updates via PATCH to `/api/books/{id}`
- Automatic page refresh after changes

**Files Created:**
- `src/lib/components/book/QuickEditOverlay.svelte` - Overlay component with rating and status controls

**Files Modified:**
- `src/lib/components/book/BookCard.svelte` - Added quickEdit prop, overlay integration
- `src/routes/books/+page.svelte` - Enabled quick edit with handleQuickEdit function
- `src/routes/+page.svelte` - Enabled quick edit on Dashboard
- `src/routes/+page.server.ts` - Added statuses to Dashboard data

### Date Formatting Standardization

Created centralized date utilities to ensure consistent date handling across the application.

**Utility Functions (`src/lib/utils/date.ts`):**
- `formatDate(dateStr, format)` - Display dates consistently ("December 12, 2023" by default)
- `toInputDate(dateStr)` - Convert DB format to HTML input format (YYYY-MM-DD)
- `fromInputDate(inputDate)` - Convert HTML input back to ISO for DB storage
- `formatRelativeDate(dateStr)` - "2 days ago" style formatting
- `getCurrentInputDate()` / `getCurrentISODate()` - Current date helpers

**Files Updated to Use Utility:**
- `src/routes/books/[id]/+page.svelte`
- `src/routes/authors/[id]/+page.svelte`
- `src/routes/authors/[id]/edit/+page.svelte`
- `src/lib/components/author/AuthorModal.svelte`
- `src/lib/components/book/BookModal.svelte`
- `src/routes/books/[id]/edit/+page.svelte`
- `src/routes/stats/+page.svelte`

### TypeScript Error Fixes

Fixed all 11 TypeScript errors across 8 files:
- `loggerService.ts` - Cast winston info fields to proper types
- `fileWatcherService.ts` - Handle unknown error type properly
- `AuthorModal.svelte` - Cast e.currentTarget to HTMLImageElement
- `DynamicIcon.svelte` - Added color prop
- `BulkActionBar` usage - Added missing totalCount and onClearSelection props
- `searchService.ts` - Added icon field to status type
- `shelves/[id]/+page.svelte` - Added default values for sortField/sortOrder

### Git Exclusions

Updated `.gitignore` to properly exclude user content:

```gitignore
# Database files
*.sqlite
*.sqlite-journal
*.sqlite-wal
*.sqlite-shm

# User content
static/covers/
!static/covers/.gitkeep
!static/covers/placeholder.png
static/ebooks/
!static/ebooks/.gitkeep

# Testing databases
testing/databases/*.sqlite
testing/databases/*.sqlite-*
```

**Cleanup:**
- Removed tracked covers, ebooks, and database files from git history
- Added `.gitkeep` files to maintain empty directories

---

## Phase 5.2: Dashboard & List View Consistency (Completed)

Standardized book display components across the application for consistent UI.

### Changes Made

**Dashboard Improvements:**
- Dashboard now uses `BookCard` component for "Currently Reading" and "Recently Added" sections
- Full book metadata displayed (author, series, rating, status, tags, ebook indicator)
- Updated page server to fetch complete `BookCardData` via `getBooksCardData()` helper
- Added user library filtering to respect Public Library feature
- Updated text colors to use CSS theme variables for dark mode support

**My Books List View:**
- List view now uses `BookRow` and `BookListHeader` components (matching author/series pages)
- Proper column layout: Title, Series, Status, Format, Rating, Genre, Tags
- Added `toBookCardData()` helper to convert `BookWithRelations` to `BookCardData`
- Grid view also uses the shared helper for consistency

**Sortable Column Headers:**
- `BookListHeader` now supports clickable column headers for sorting
- Click column to sort by that field, click again to toggle asc/desc
- Sort indicators (arrows) show current sort field and direction
- Sorting disabled when `onSort` prop not provided (backwards compatible)
- Added support for sorting by related fields: series, status, format, genre
- Backend uses subqueries for efficient related-field sorting

**Backend Sort Extensions:**
- Extended `GetBooksOptions.sort` to include: `series`, `status`, `format`, `genre`
- Sorting by related entities uses SQL subqueries for efficiency
- Updated page server to accept new sort field types

**Files Modified:**
- `src/routes/+page.svelte` - Dashboard uses BookCard with full metadata
- `src/routes/+page.server.ts` - Fetch complete BookCardData, library filtering
- `src/routes/books/+page.svelte` - List view uses BookRow/BookListHeader, sort handler
- `src/routes/books/+page.server.ts` - Accept new sort field types
- `src/lib/components/book/BookListHeader.svelte` - Sortable columns with indicators
- `src/lib/server/services/bookService.ts` - Extended sort options with subqueries

---

## Phase 5.1: UI Polish & Consistency (Completed)

Improved UI consistency across entity pages with better list views and bulk operations.

### Changes Made

**List View Improvements:**
- Redesigned `BookRow.svelte` with CSS Grid layout for table-like appearance
- Added columns: Title/Author, Series (#), Status, Format, Rating, Genre, Tags
- Created `BookListHeader.svelte` for column headers with select-all checkbox
- Responsive design hides less important columns on smaller screens
- Added grid/list view toggle to author and series detail pages

**Bulk Operations Fix:**
- Fixed 500 error on author/series pages caused by incorrect modal props
- Updated bulk modals to use `{#if}` conditional rendering pattern
- Added tags and statuses data fetching to author and series page loaders

**Naming Consistency:**
- Renamed "Shelves" section in sidebar to "Statuses" (shows reading statuses)
- Renamed "Magic Shelves" to "Smart Collections" throughout the app
- Updated icons from `Sparkles` to `Wand2` for Smart Collections
- Updated navbar, sidebar, and `/shelves` page labels

**Genre Display:**
- Genres in sidebar now show custom icons (if set) using DynamicIcon
- Genres display with their assigned colors
- Updated layout server to fetch genre `color` and `icon` fields

**Files Modified:**
- `src/lib/components/book/BookRow.svelte` - Complete redesign with grid layout
- `src/lib/components/book/BookListHeader.svelte` - New component
- `src/lib/components/layout/Sidebar.svelte` - Renamed sections, genre icons
- `src/lib/components/layout/Navbar.svelte` - Updated Collections label
- `src/routes/shelves/+page.svelte` - Smart Collections terminology
- `src/routes/+layout.server.ts` - Added genre color/icon to query
- `src/routes/authors/[id]/+page.server.ts` - Added tags/statuses data
- `src/routes/authors/[id]/+page.svelte` - Added list view header
- `src/routes/series/[id]/+page.server.ts` - Added tags/statuses data
- `src/routes/series/[id]/+page.svelte` - Fixed bulk modal props, added header

---

## Phase 4.5: Entity Detail Pages (Completed)

Series and Author detail pages with compact layout and inline editing.

**Files Created:**
- `src/routes/series/[id]/+page.svelte` - Series detail page
- `src/routes/series/[id]/edit/+page.svelte` - Series edit page
- `src/routes/authors/[id]/+page.svelte` - Author detail page
- `src/routes/authors/[id]/edit/+page.svelte` - Author edit page

**Features:**
- Compact stats bar with inline stats (X/Y read, rating, percentage)
- Progress bar with completion status
- Details grid with 3 columns: Description/Bio, Notes, Tags/Series
- Inline editing for text fields (click-to-edit with Save/Cancel)
- Tag picker toggle for quick tag management
- Universal BookCard component for book grids

---

## Phase 4.4: Book Edit Page Redesign (Completed)

Converted book edit from modal to dedicated page with tabbed interface.

**Files Created/Modified:**
- `src/routes/books/[id]/edit/+page.svelte` - Book edit page
- `src/routes/books/[id]/edit/+page.server.ts` - Edit page data loader

**Features:**
- Tabbed interface (Basic, Summary, IDs, Cover, Status, Ebook)
- Multi-book/omnibus support (bookNumEnd field for series)
- Compact, space-efficient form layout
- Sidebar with cover preview and quick rating
- Author/series picker with search
- ISBN/title auto-lookup from Open Library & Google Books

---

## Bulk Operations (Completed)

Multi-select books and perform batch operations.

**Files Created:**
- `src/lib/stores/selection.ts` - Selection state store with toggle, selectAll, clear
- `src/lib/components/bulk/BulkActionBar.svelte` - Floating action bar with tag/status/delete buttons
- `src/lib/components/bulk/BulkTagModal.svelte` - Add/remove tags from multiple books
- `src/lib/components/bulk/BulkStatusModal.svelte` - Change status for multiple books
- `src/lib/components/bulk/BulkDeleteModal.svelte` - Delete confirmation with "DELETE" typing requirement
- `src/routes/api/books/bulk/tags/+server.ts` - Bulk tag add/remove endpoint
- `src/routes/api/books/bulk/status/+server.ts` - Bulk status change endpoint
- `src/routes/api/books/bulk/delete/+server.ts` - Bulk delete endpoint (with file cleanup)

**Features:**
- Select mode toggle on books page
- Select all / deselect all functionality
- Bulk add/remove tags with mode toggle
- Bulk status change with visual status picker
- Bulk delete with safety confirmation (type "DELETE")
- Automatic file cleanup (covers and ebooks) on delete

---

## Magic Shelves (Completed)

Dynamic, rule-based collections that automatically show books matching filter criteria.

**Database Schema:**
```sql
CREATE TABLE magicshelves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'bookmark',
  iconColor TEXT DEFAULT '#6c757d',
  filterJson TEXT NOT NULL,
  sortField TEXT DEFAULT 'title',
  sortOrder TEXT DEFAULT 'asc',
  isPublic INTEGER DEFAULT 0,
  userId INTEGER REFERENCES users(id),
  displayOrder INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT
);
```

**Files Created:**
- `src/lib/server/services/magicShelfService.ts` - Complete service with filter rule types, CRUD, dynamic SQL query builder
- `src/routes/api/shelves/+server.ts` - GET all, POST new shelf
- `src/routes/api/shelves/[id]/+server.ts` - GET, PUT, DELETE shelf
- `src/routes/api/shelves/[id]/books/+server.ts` - GET books matching shelf rules
- `src/routes/api/shelves/preview/+server.ts` - POST to preview filter without saving
- `src/lib/components/shelves/ShelfRuleBuilder.svelte` - Visual rule builder UI
- `src/lib/components/shelves/ShelfCard.svelte` - Shelf preview card with book count
- `src/lib/components/shelves/ShelfModal.svelte` - Create/edit modal
- `src/routes/shelves/+page.svelte` - Shelf list page
- `src/routes/shelves/[id]/+page.svelte` - Shelf detail page with book grid

**Filter Rule Schema:**
```typescript
interface FilterRule {
  field: string;           // 'statusId', 'rating', 'authorId', etc.
  operator: FilterOperator; // 'equals', 'contains', 'greater_than', etc.
  value: string | number | string[] | number[] | null;
}

interface FilterGroup {
  logic: 'AND' | 'OR';
  rules: (FilterRule | FilterGroup)[];
}
```

**Supported Filter Fields:**
- title, statusId, genreId, formatId, rating, pageCount, publishYear
- authorId, seriesId, tagId, narratorId (junction table queries)
- completedDate, startReadingDate, releaseDate, createdAt
- ebookPath, coverImageUrl (has/doesn't have)
- isbn13, language, publisher

---

## Ebook Import (Completed)

Drag-and-drop ebook file import with automatic metadata extraction.

**Files Created:**
- `src/lib/server/services/ebookMetadataService.ts` - Metadata extraction service
- `src/routes/api/import/ebooks/+server.ts` - Upload, preview, execute import
- `src/routes/import/+page.svelte` - Updated with "Ebooks" tab

**Supported Formats:**
- EPUB (full metadata extraction from OPF)
- PDF (filename parsing)
- MOBI (filename parsing)
- AZW/AZW3 (filename parsing)
- CBZ (ComicInfo.xml + first image as cover)
- CBR (ComicInfo.xml + first image as cover)

**Import Flow:**
1. Drag files onto drop zone or click to browse
2. Click "Upload & Preview" to extract metadata
3. Review and edit title/authors for each file
4. Select which files to import
5. Files saved to `/static/ebooks/`, covers to `/static/covers/`

---

## Settings Page (Completed)

Configurable application settings including storage paths with customizable file organization patterns.

**Files Created:**
- `src/lib/server/services/settingsService.ts` - Settings management service
- `src/routes/api/settings/+server.ts` - Settings API
- `src/routes/settings/+page.server.ts` and `+page.svelte` - Settings UI

**Available Settings:**

| Category | Key | Default | Description |
|----------|-----|---------|-------------|
| storage | `storage.covers_path` | `./static/covers` | Cover image directory |
| storage | `storage.ebooks_path` | `./static/ebooks` | Ebook file directory |
| storage | `storage.ebook_path_pattern` | `{filename}` | Ebook file organization |
| library | `library.name` | `BookShelf` | Library name for OPDS |
| display | `display.books_per_page` | `24` | Books per page |
| display | `display.default_sort` | `title` | Default sort field |
| opds | `opds.enabled` | `true` | Enable OPDS catalog |
| import | `import.auto_detect_series` | `true` | Auto-detect series |

**Path Pattern Placeholders:**
- `{author}` - Primary author name
- `{series}` - Series name (if available)
- `{title}` - Book title
- `{format}` - File format
- `{filename}` - Original filename with hash

---

## Logging & Error Management (Completed)

Winston-based logging infrastructure with daily log rotation and admin console.

**Files Created:**
- `src/lib/server/services/loggerService.ts` - Winston logger configuration
- `src/hooks.server.ts` - Request logging, global error handler
- `src/routes/admin/console/+page.svelte` - Admin console UI
- `src/routes/api/admin/logs/+server.ts` - Logs API

**Features:**
- Log levels: error, warn, info, http, debug
- Console output (colorized) and file output (JSON)
- Daily log rotation with configurable retention
- In-memory log buffer (500 entries) for admin console
- Real-time log viewing with auto-refresh
- Click level to filter, text search by context
- Expandable entries for full metadata/stack traces

**Admin Console Access:**
- Available at `/admin/console` (admin users only)
- Accessed via user dropdown menu (Admin → Console)

---

## OPDS Catalog (Completed)

OPDS 1.2 feed for e-reader apps like KOReader, Moon+ Reader, Calibre.

**Files Created:**
- `src/lib/server/services/opdsService.ts` - Complete OPDS 1.2 feed generation
- `src/routes/opds/+server.ts` - Root catalog
- `src/routes/opds/books/+server.ts` - All books feed
- `src/routes/opds/books/recent/+server.ts` - Recently added
- `src/routes/opds/search/+server.ts` - Search
- `src/routes/opds/authors/+server.ts` and `[id]/+server.ts`
- `src/routes/opds/series/+server.ts` and `[id]/+server.ts`
- `src/routes/opds/genres/+server.ts` and `[id]/+server.ts`

**Authentication:**
- HTTP Basic Auth required for all `/opds/*` routes
- Uses existing user credentials (email + password)

**Feed Structure:**
```
/opds                    # Root catalog (navigation)
├── /opds/books          # All books (acquisition, paginated)
├── /opds/books/recent   # Recently added books
├── /opds/search?q=term  # Search results
├── /opds/authors        # Authors list (navigation)
├── /opds/series         # Series list (navigation)
└── /opds/genres         # Genres list (navigation)
```

---

## Statistics Dashboard (Completed)

Comprehensive reading statistics and analytics dashboard.

**Files Created/Modified:**
- `src/lib/server/services/statsService.ts` - Stats aggregation service
- `src/lib/server/services/goalsService.ts` - Reading goals service
- `src/routes/stats/+page.svelte` - Stats dashboard UI
- `src/routes/stats/goals/+page.svelte` - Reading goals management

**Dashboard Features:**
- Stat cards (total books, read, pages, avg rating)
- Monthly reading bar chart
- Status distribution with progress bars
- Rating distribution histogram
- Top authors with clickable links
- Genre tags with clickable links
- Reading timeline with year navigation
- Highlight cards (longest book, best rated, most read author)

**Reading Goals Features:**
- Current year goal with large progress display
- Pace tracking (ahead/behind/on track)
- Monthly breakdown visualization
- CRUD for all goals

---

## BookDrop (Completed)

Automatic ebook import with folder watching and upload queue management.

**Database Schema:**
```sql
CREATE TABLE bookdrop_queue (
  id INTEGER PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  filename TEXT NOT NULL,
  filePath TEXT NOT NULL,
  fileSize INTEGER,
  fileHash TEXT,
  source TEXT DEFAULT 'upload',
  status TEXT DEFAULT 'pending',
  bookId INTEGER REFERENCES books(id),
  metadata TEXT,
  coverData TEXT,
  errorMessage TEXT,
  processedAt TEXT,
  createdAt TEXT
);

CREATE TABLE bookdrop_settings (
  id INTEGER PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  folderPath TEXT,
  enabled INTEGER DEFAULT 1,
  autoImport INTEGER DEFAULT 0,
  afterImport TEXT DEFAULT 'move',
  processedFolder TEXT,
  afterSkip TEXT DEFAULT 'keep',
  skippedFolder TEXT,
  defaultStatusId INTEGER,
  defaultFormatId INTEGER
);
```

**Files Created:**
- `src/lib/server/services/bookdropService.ts` - Queue management service
- `src/lib/server/services/fileWatcherService.ts` - Folder watcher (chokidar)
- `src/routes/api/bookdrop/+server.ts` - Queue list API
- `src/routes/api/bookdrop/upload/+server.ts` - File upload
- `src/routes/api/bookdrop/[id]/+server.ts` - Item actions
- `src/routes/api/bookdrop/bulk/+server.ts` - Bulk actions
- `src/routes/api/bookdrop/settings/+server.ts` - Settings API
- `src/routes/admin/bookdrop/+page.svelte` - BookDrop admin UI

**Features:**
- Upload via UI: Drag & drop or file picker
- Folder Watching: Configure path to auto-detect new ebooks
- Metadata Extraction: Title, author, cover, ISBN from EPUB/CBZ
- Preview Mode: Review before importing (default)
- Auto-Import Mode: Optional automatic import
- Edit Before Import: Modify title, author, status, format, genre
- Bulk Actions: Import all, skip selected, delete selected
- Duplicate Detection: Uses file hash
- Post-Import Actions: Keep, move, or delete original files

---

## Import/Export (Completed)

**Import Features:**
- CSV parsing with quote handling
- Goodreads format auto-detection
- Series extraction from titles ("Title (Series, #1)")
- Author fuzzy matching
- Duplicate detection (ISBN, Goodreads ID, ASIN, fuzzy title/author)
- Book lookup via Open Library + Google Books APIs
- Audible HTML import with cover URL reconstruction
- Entity dropdowns with "Add new" option

**Export Features:**
- Full BookShelf CSV format
- Goodreads-compatible CSV format
- JSON export with complete entity lists
- Configurable include/exclude options
- Export UI at /export

---

## UI/UX Features (Completed)

- **Dark Theme** - CSS variables with light/dark toggle, localStorage persistence
- **Persistent Sidebar** - Navigation with genre/status counts, collapsible sections
- **Top Navbar** - Global search (Cmd/Ctrl+K), quick add, theme toggle, user menu
- **Book Detail Page** - Large cover, genre tags, metadata layout, action buttons
- **Enhanced Book Grid** - Series number badges, compact cards
- **Filters Sidebar** - Collapsible filter sections on book list page
- **Mobile Responsive** - Mobile sidebar overlay, responsive layouts
- **Keyboard Shortcuts** - Global search (Cmd/Ctrl+K)

---

## Core CRUD (Completed)

- Authentication (login/logout, sessions, account lockout)
- Books CRUD with modal view/edit
- Authors CRUD with book counts
- Series CRUD with book counts
- Tags CRUD with system tags (Favorite, Wishlist)
- Genres CRUD with colors/icons, display order
- Formats CRUD (Hardcover, Paperback, Ebook, Audiobook)
- Narrators CRUD with bio, URL
- Statuses management (Read, Reading, To Read, DNF, etc.)

---

## Search & Discovery (Completed)

- **Global Search** - Full-text with autocomplete, keyboard shortcut (Cmd/Ctrl+K)
- **Advanced Search Page** - Multi-criteria filtering
- **Sorting** - By title, author, date added, rating, completed date, release date, page count
