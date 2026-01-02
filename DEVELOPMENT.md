# BookShelf V2 - Development Standards Guide

## Documentation Index

This project uses split documentation for better organization:

| Document | Purpose |
|----------|---------|
| **DEVELOPMENT.md** (this file) | Coding standards, patterns, project structure |
| **[docs/CHANGELOG.md](docs/CHANGELOG.md)** | Completed features with implementation details |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Future phases and planned features |

---

## Project Overview

BookShelf V2 is a complete rewrite of the BookShelf book library management application.

**Stack:**
- SvelteKit (framework)
- TypeScript (language)
- Drizzle ORM (database)
- SQLite (database engine)
- Tailwind CSS (styling)

---

## Project Structure

```
BookShelfV2/
├── src/
│   ├── lib/
│   │   ├── server/              # Server-only code
│   │   │   ├── db/
│   │   │   │   ├── schema.ts    # Drizzle schema definitions
│   │   │   │   ├── index.ts     # Database connection
│   │   │   │   └── migrations/  # Migration files
│   │   │   ├── services/        # Business logic
│   │   │   └── utils/           # Server utilities
│   │   ├── components/          # Svelte components
│   │   │   ├── ui/              # Generic UI components
│   │   │   ├── book/            # Book-specific components
│   │   │   ├── bulk/            # Bulk operation components
│   │   │   ├── shelves/         # Magic shelf components
│   │   │   ├── layout/          # Layout components
│   │   │   ├── pickers/         # Selection components
│   │   │   ├── stats/           # Statistics components
│   │   │   └── reader/          # Ebook reader components
│   │   ├── stores/              # Svelte stores (global state)
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Shared utilities
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout
│   │   ├── +page.svelte         # Dashboard
│   │   ├── books/               # Book pages
│   │   ├── authors/             # Author pages
│   │   ├── series/              # Series pages
│   │   ├── shelves/             # Magic shelves
│   │   ├── stats/               # Statistics
│   │   ├── admin/               # Admin pages
│   │   ├── opds/                # OPDS catalog
│   │   └── api/                 # API routes
│   └── docs/                    # Swagger UI page
├── static/
│   ├── covers/                  # Book cover images
│   └── ebooks/                  # Ebook files
├── docs/                        # Documentation
│   ├── CHANGELOG.md             # Completed features
│   └── ROADMAP.md               # Future plans
└── package.json
```

---

## Coding Standards

### TypeScript

1. **Strict mode enabled** - No `any` unless absolutely necessary
2. **Explicit return types** on exported functions
3. **Use interfaces** for object shapes, types for unions/primitives

```typescript
interface Book {
  id: number;
  title: string;
  rating: number | null;
}

export function getBook(id: number): Promise<Book | null> {
  // ...
}
```

### Svelte Components

1. **One component per file**
2. **Props at the top** using `$props()` rune
3. **Derived state** with `$derived` rune
4. **Effects** with `$effect` rune (use sparingly)

```svelte
<script lang="ts">
  import type { Book } from '$lib/types';

  let { book, onEdit, onDelete }: {
    book: Book;
    onEdit: (book: Book) => void;
    onDelete: (id: number) => void;
  } = $props();

  let displayTitle = $derived(book.title || 'Untitled');
  let isHovered = $state(false);
</script>
```

### API Routes

1. **Always return JSON** from API routes
2. **Consistent error format**
3. **Validate input** before processing
4. **Use appropriate HTTP methods and status codes**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1');
  const result = await getBooks({ page });
  return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  const data = await request.json();
  if (!data.title?.trim()) {
    throw error(400, { message: 'Title is required' });
  }
  const book = await createBook(data);
  return json(book, { status: 201 });
};
```

### Database Queries

1. **Use Drizzle's type-safe queries**
2. **Keep queries in service files**, not in routes
3. **Handle relations explicitly**

```typescript
import { db } from '$lib/server/db';
import { books, bookAuthors, authors } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function getBookWithAuthors(id: number) {
  const result = await db
    .select()
    .from(books)
    .leftJoin(bookAuthors, eq(books.id, bookAuthors.bookId))
    .leftJoin(authors, eq(bookAuthors.authorId, authors.id))
    .where(eq(books.id, id));

  return transformBookWithAuthors(result);
}
```

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase.svelte | `BookCard.svelte` |
| Files (modules) | camelCase.ts | `bookService.ts` |
| Files (routes) | lowercase with hyphens | `reading-goals/` |
| Variables | camelCase | `bookCount` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Types/Interfaces | PascalCase | `interface Book` |
| Database tables | camelCase (plural) | `books`, `bookAuthors` |
| Database columns | camelCase | `coverImageUrl` |

---

## State Management

| State Type | Use Case | Example |
|------------|----------|---------|
| Component state (`$state`) | Local UI state | `isOpen`, `searchQuery` |
| Derived (`$derived`) | Computed from other state | `filteredBooks` |
| Props | Parent-to-child data | `book`, `onSave` |
| Stores | Cross-component state | `user`, `toasts`, `selectedBooks` |
| Server load | Initial page data | Book list, settings |

### Store Pattern

```typescript
// src/lib/stores/selection.ts
import { writable, derived } from 'svelte/store';

function createSelectionStore() {
  const { subscribe, set, update } = writable<Set<number>>(new Set());

  return {
    subscribe,
    toggle: (id: number) => update(set => {
      const newSet = new Set(set);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    }),
    clear: () => set(new Set()),
    selectAll: (ids: number[]) => set(new Set(ids))
  };
}

export const selectedBooks = createSelectionStore();
```

---

## API Design

### REST Conventions

| Action | Method | Route | Response |
|--------|--------|-------|----------|
| List | GET | `/api/books` | `{ items: [], total: n }` |
| Get one | GET | `/api/books/:id` | `{ id, title, ... }` |
| Create | POST | `/api/books` | `{ id, title, ... }` (201) |
| Update | PUT | `/api/books/:id` | `{ id, title, ... }` |
| Delete | DELETE | `/api/books/:id` | `{ success: true }` |

### Query Parameters

```
GET /api/books?page=1&limit=24&sort=title&order=asc&status=1&genre=5&q=search
```

### Error Responses

```json
{
  "error": {
    "message": "Book not found",
    "code": "NOT_FOUND"
  }
}
```

---

## Entity Detail Page Pattern (DEFAULT STANDARD)

This is the **standard layout pattern** for all entity detail pages (authors, series, genres, tags, shelves, etc.). New detail pages MUST follow this format for consistency.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to [Entity List]                                         │
├─────────────────────────────────────────────────────────────────┤
│ [Icon/Photo]  Entity Name                     [Edit] [Delete]   │
│               Subtitle/meta info                                │
│               Links (external URLs)                             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Compact Stats Bar ─────────────────────────────────────────┐ │
│ │  X/Y read    ★ 4.2    N series/items              XX%       │ │
│ │  ═══════════════════════════════════════════════════        │ │
│ │  Status: Complete! / X left to read                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Details Grid (3 columns, responsive) ────────────────────┐   │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │   │
│ │ │ DESCRIPTION │ │ NOTES       │ │ TAGS/SERIES │          │   │
│ │ │ [✏️]        │ │ [✏️]        │ │ [+]         │          │   │
│ │ │             │ │             │ │             │          │   │
│ │ │ Click to    │ │ Click to    │ │ Badge list  │          │   │
│ │ │ add...      │ │ add...      │ │ + picker    │          │   │
│ │ └─────────────┘ └─────────────┘ └─────────────┘          │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Related Items (Books Grid) ────────────────────────────────┐ │
│ │  📚 Books (N)                              [+ Add Book]     │ │
│ │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │ │
│ │  │Cover│ │Cover│ │Cover│ │Cover│ │Cover│ ...               │ │
│ │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                   │ │
│ │  Title   Title   Title   Title   Title                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Compact Stats Bar** - Single row with inline stats (not individual stat cards)
   - Format: `X/Y read` | `★ rating` | `additional stats` | `percentage%`
   - Thin progress bar below
   - Status row for completion/next items

2. **Details Grid** - 3-column responsive grid (2-col at 900px, 1-col at 600px)
   - Each card has uppercase label header with edit icon
   - Content is click-to-edit (entire content area is clickable)
   - Inline editing with textarea + Save/Cancel buttons
   - Empty state shows "Click to add..." placeholder

3. **Inline Editing** - Quick edits without navigation
   - Pencil icon in header triggers edit mode
   - Save updates via PATCH/PUT API
   - `invalidateAll()` refreshes data after save
   - Cancel reverts without saving

4. **Tag/Relation Picker** - Toggle-style picker
   - Plus button toggles picker visibility
   - Selected items shown as badges
   - Picker shows all available items with checkmarks

5. **BookCard Grid** - Universal book display
   - Use `<BookCard>` component for consistency
   - `onClick` prop for navigation
   - Responsive grid with auto-fill columns

### Standard CSS Classes

```css
.page-container { max-width: 1400px; padding: 1rem 1rem 2rem; }
.back-link { font-size: 0.8rem; color: var(--text-muted); }
.stats-bar { background: var(--bg-secondary); border-radius: 0.5rem; padding: 0.75rem 1rem; }
.progress-row { display: flex; justify-content: space-between; }
.stat-inline { font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.25rem; }
.progress-bar { height: 6px; background: var(--bg-tertiary); border-radius: 3px; }
.details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
.detail-card { background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.75rem; }
.detail-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); }
.books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
```

### Edit Page Pattern

For comprehensive editing, use a dedicated route:
- Route: `/[entity]/[id]/edit`
- Full form with all editable fields
- Cancel returns to detail page
- Save via API then redirect to detail page

---

## Quick Reference

### Create a new API endpoint

1. Create file in `src/routes/api/[resource]/+server.ts`
2. Export GET/POST/PUT/DELETE handlers
3. Use service layer for business logic
4. Return JSON responses

### Create a new page

1. Create folder in `src/routes/[page]/`
2. Add `+page.svelte` for UI
3. Add `+page.server.ts` for data loading
4. Use layout for consistent structure

### Create a new component

1. Create file in appropriate `src/lib/components/` subfolder
2. Use TypeScript for props
3. Keep styles in component with Tailwind
4. Export from index if reusable

### Add a database table

1. Add schema in `src/lib/server/db/schema.ts`
2. Run `npx drizzle-kit generate`
3. Run `npx drizzle-kit migrate`

---

## API Testing

### Swagger UI (Web Browser)

Visit **http://localhost:5173/docs** to explore the API interactively.

### REST Client (VS Code)

The `api.http` file contains example requests for testing with the REST Client extension.

---

## App Configuration

### Version & Copyright

Version and copyright information is centralized in `src/lib/config/app.ts`:

```typescript
// src/lib/config/app.ts
export const APP_CONFIG = {
  name: 'BookShelf',
  version: '2.0.0',
  copyright: {
    owner: 'Ernie',
    year: 2026
  },
  get versionString() { return `v${this.version}`; },
  get copyrightString() { return `${this.copyright.year} ${this.copyright.owner}`; }
};
```

**Usage in components:**

```svelte
<script lang="ts">
  import { APP_CONFIG } from '$lib/config/app';
</script>

<p>{APP_CONFIG.versionString}</p>
<p>&copy; {APP_CONFIG.copyrightString}</p>
```

**Where it's displayed:**
- Sidebar footer (visible on all authenticated pages)
- Login page footer

**To update version/copyright:**
1. Edit `src/lib/config/app.ts`
2. Update the `version`, `copyright.owner`, or `copyright.year` values
3. Changes apply automatically across all pages

---

## Environment Variables

```env
DATABASE_PATH=./data/database.sqlite
COVERS_PATH=./data/covers
EBOOKS_PATH=./data/ebooks
SESSION_SECRET=your-secret-here

# Optional
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
LOG_LEVEL=debug
LOG_DIR=./logs
```

---

## Git Workflow

1. **Main branch**: Production-ready code
2. **Feature branches**: `feature/book-modal`, `feature/ebook-reader`
3. **Commits**: Conventional commits (`feat:`, `fix:`, `refactor:`)

---

## Performance Guidelines

1. **Lazy load** heavy components (reader, charts)
2. **Pagination** for all lists
3. **Debounce** search inputs
4. **Skeleton loaders** during data fetching
5. **Image optimization** for covers

---

## Security Checklist

- [ ] All routes check authentication
- [ ] Input validation on all endpoints
- [ ] Password hashing with bcrypt
- [ ] Session management with secure cookies
- [ ] CSRF protection
- [ ] Rate limiting on auth endpoints
- [ ] File upload validation
- [ ] SQL injection prevention (Drizzle handles this)
