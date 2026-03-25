# CLAUDE.md - BookShelf

This file provides guidance for AI assistants working with the BookShelf codebase.

## Project Overview

BookShelf is a self-hosted personal book library management application built with SvelteKit. It enables users to organize books, track reading progress, manage ebooks (EPUB/PDF/CBZ), and view reading statistics.

**Key Features:**
- Book library organization with authors, series, genres, tags
- Ebook reading (EPUB, PDF, CBZ/Comics)
- Audiobook management
- Reading progress and session tracking
- Statistics and reading goals
- Multi-user support with role-based access control
- OPDS catalog for e-readers
- Metadata fetching from 6 providers (Google Books, Open Library, Goodreads, Hardcover, Amazon, ComicVine)

## Tech Stack

- **Framework:** SvelteKit 2.x with Svelte 5 (runes)
- **Language:** TypeScript (strict mode)
- **Database:** SQLite with Drizzle ORM
- **Styling:** Tailwind CSS
- **Runtime:** Node.js 20 LTS
- **Containerization:** Docker with Alpine

## Directory Structure

```
src/
├── lib/
│   ├── config/app.ts              # App config (name, version)
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts           # Database connection
│   │   │   └── schema.ts          # Drizzle table definitions (34 tables)
│   │   ├── services/              # Business logic (54 service files)
│   │   └── metadataProviders/     # External metadata sources
│   ├── components/                # Svelte components by domain
│   ├── stores/                    # Svelte stores (toast, selection, sidebar, theme)
│   ├── types/                     # Shared TypeScript types
│   └── utils/                     # Utility functions
├── routes/                        # SvelteKit pages and API endpoints
│   ├── api/                       # REST API endpoints (130+)
│   └── [page routes]              # Page components
├── hooks.server.ts                # Auth, security headers, middleware
└── app.css                        # Global styles and theme
```

## Common Commands

```bash
# Development
npm run dev                    # Start dev server (port 5173)
npm run check                  # TypeScript/Svelte type checking
npm run build                  # Production build

# Database
npm run db:generate            # Generate Drizzle migrations
npm run db:migrate             # Apply migrations
npm run db:studio              # Open Drizzle Studio UI

# Docker
docker compose up -d           # Start container
docker compose logs -f         # View logs
```

## Architecture Patterns

### Service Layer
Business logic is encapsulated in service files (`src/lib/server/services/`). Each service handles a specific domain:
- `bookService.ts` - Book CRUD and queries
- `authService.ts` - Authentication and sessions
- `userService.ts` - User management
- `dashboardService.ts` - Statistics and charts
- `goalsService.ts` - Reading goals (6 types)

### Database Access
- Drizzle ORM for type-safe queries
- Relations defined with foreign keys
- Per-user filtering via `userId` fields
- WAL mode enabled for concurrent access

### API Design
- RESTful endpoints in `src/routes/api/`
- JSON request/response bodies
- Role-based access control enforcement
- Consistent error format: `{ message: string, details?: any }`

### State Management
- Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Stores for cross-component state
- Server load functions for SSR data

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/server/db/schema.ts` | All database table definitions |
| `src/hooks.server.ts` | Auth middleware, security headers |
| `src/routes/+layout.server.ts` | Root layout data loading |
| `src/lib/config/app.ts` | App name, version, copyright |
| `drizzle.config.ts` | Database configuration |
| `svelte.config.js` | SvelteKit configuration |

## Database Schema

**Core Tables:**
- `books` - Main book records
- `authors`, `narrators` - People
- `series` - Book series
- `genres`, `formats`, `tags`, `statuses` - Categorization
- `users`, `sessions` - Authentication
- `magicShelves` - Smart collections with filter rules
- `readingSessions` - Reading activity tracking
- `userBooks` - Per-user book data (status, rating, progress)

**Junction Tables:**
- `bookAuthors` - Books ↔ Authors (many-to-many with roles)
- `bookSeries` - Books ↔ Series
- `bookTags` - Books ↔ Tags

## API Endpoint Patterns

```
GET    /api/[entity]           # List with pagination
POST   /api/[entity]           # Create
GET    /api/[entity]/[id]      # Get single
PUT    /api/[entity]/[id]      # Update
DELETE /api/[entity]/[id]      # Delete
POST   /api/books/bulk/[action]  # Bulk operations
```

## Authentication & Authorization

- Session-based auth with bcrypt password hashing
- Cookies stored in SQLite `sessions` table
- Roles: `admin`, `librarian`, `member`, `viewer`, `guest`
- OIDC support for SSO
- Account lockout after 5 failed attempts (15 min)

## Environment Variables

Required:
- `SESSION_SECRET` - Session encryption key
- `ORIGIN` - Full server URL (production)

Optional:
- `DATABASE_PATH` - SQLite database location
- `PORT` - Server port (default 3000)
- `COVERS_PATH`, `EBOOKS_PATH` - Asset directories
- `SMTP_*` - Email configuration
- `OPENAI_API_KEY` - AI recommendations

## Code Style Guidelines

- Use Svelte 5 runes (`$state`, `$derived`) not legacy `let` reactive
- TypeScript strict mode - no `any` types
- Services handle business logic, routes handle HTTP
- Use Drizzle queries, not raw SQL
- Components organized by domain in `src/lib/components/`
- API responses return `json()` from SvelteKit

## Testing

Run the dev server with test database:
```bash
DATABASE_PATH=./testing/databases/current.sqlite npm run dev
```

## Docker Volumes

| Volume | Purpose |
|--------|---------|
| `bookshelf_data` | SQLite database |
| `bookshelf_logs` | Application logs |
| `bookshelf_covers` | Book cover images |
| `bookshelf_ebooks` | User ebook files |
| `bookshelf_audiobooks` | Audiobook files |

## Common Tasks

### Adding a New API Endpoint
1. Create route file in `src/routes/api/[domain]/+server.ts`
2. Import relevant service from `$lib/server/services`
3. Add role checks using `locals.user.role`
4. Return JSON with appropriate status codes

### Adding a Database Table
1. Add table definition to `src/lib/server/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply

### Adding a New Component
1. Create in appropriate domain folder under `src/lib/components/`
2. Use TypeScript for props typing
3. Use Svelte 5 runes for reactivity

## Local Development Files

The `dev_only/` folder is for local files that should NOT be synced to GitHub:
- Temporary scripts and utilities
- Local configuration overrides
- Test data and scratch files
- Personal notes and drafts

This folder is gitignored. Use it to store anything you don't want committed.

## Versioning

**IMPORTANT:** When making commits, always update the version in `package.json`:
- Bump patch version (x.x.N) for bug fixes and minor changes
- Bump minor version (x.N.0) for new features
- Bump major version (N.0.0) for breaking changes

The version should be updated as part of the same commit as the changes.

## "Push It" Workflow

When the user says **"push it"**, perform the complete release workflow:

1. **Update CHANGELOG.md** - Add entry for the new version with today's date and description of changes
2. **Update version** in `package.json` (if not already done)
3. **Update documentation** if the feature affects user-facing docs (ROADMAP.md, README.md, etc.)
4. **Commit** all changes with a descriptive commit message
5. **Create git tag** for the new version: `git tag -a vX.X.X -m "vX.X.X - Brief description"`
6. **Push** commits and tags: `git push && git push --tags`
7. **Create GitHub release**: `gh release create vX.X.X --title "vX.X.X" --notes "Brief description of changes"`

Example:
```bash
# After updating CHANGELOG.md, package.json, and any docs
git add -A
git commit -m "Feature description"
git tag -a v2.4.13 -m "v2.4.13 - Feature description"
git push && git push --tags
gh release create v2.4.13 --title "v2.4.13" --notes "Brief description of changes"
```

## Gotchas

- `$lib/server/` code cannot be imported in client-side code
- Always use `locals.user.id` for user-specific queries
- Book covers stored in `static/covers/` (mapped to `/covers/` URL)
- CSRF protection requires `trustedOrigins` in `svelte.config.js`
- Migrations run automatically on server startup
- Never add any Anthropic branding to commits or releases.  No Created by Claude type stuff
