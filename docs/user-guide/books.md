---
layout: default
title: Managing Books
parent: User Guide
nav_order: 1
---

# Managing Books
{: .no_toc }

Learn how to add, organize, and manage your book collection.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Adding Books

### Manual Entry

Click the **"+ Add Book"** button to add a book manually:

1. **Basic Information**
   - Title (required)
   - Authors - add multiple authors with roles
   - Rating (0-5 stars, half-stars supported)
   - Status (Read, Currently Reading, Want to Read, etc.)

2. **Details**
   - ISBN-10 / ISBN-13
   - ASIN (Amazon ID)
   - Publisher and publication year
   - Page count
   - Language
   - Edition
   - Purchase price

3. **Classification**
   - Genre
   - Format (Paperback, Hardcover, Ebook, Audiobook)
   - Series and book number
   - Tags (custom organization)

4. **Dates**
   - Release date
   - Start reading date
   - Completion date

5. **Personal Notes**
   - Summary/description
   - Personal comments
   - DNF (Did Not Finish) tracking

6. **Cover Image**
   - Upload from your computer
   - Or provide a URL

### ISBN Lookup

Save time by looking up books by ISBN:

1. Click **"+ Add Book"**
2. Click the **"ISBN Lookup"** button
3. Enter ISBN (10 or 13 digit)
4. BookShelf searches multiple providers:
   - Google Books
   - Open Library
   - Goodreads
   - Hardcover
   - Amazon
   - ComicVine (for comics)
5. Review fetched metadata
6. Click fields to include/exclude
7. Save to create the book

### Search & Add

Search for books online without an ISBN:

1. Click **"Metadata Search"**
2. Enter book title and/or author
3. Browse results from multiple providers
4. Click a result to preview metadata
5. Add to your library

### BookDrop Auto-Import

Drop ebook files into a folder and have them automatically imported:

1. **Enable BookDrop** in Admin → BookDrop settings
2. **Set watch folder** (default: `/app/bookdrop` in Docker)
3. **Drop files** into the folder:
   - Supported: EPUB, PDF, CBZ, CBR
4. BookShelf automatically:
   - Detects new files
   - Extracts metadata from file
   - Creates book entry
   - Moves file to ebooks folder
   - Notifies you on dashboard

## Viewing Books

### Grid View

The default view shows books as cards with covers:

- **Hover actions**: Quick access to Read, View, Menu
- **Status indicators**: Visual badges for Currently Reading, DNF, etc.
- **Rating display**: Star ratings on cards
- **Progress indicators**: For books you're reading

### List View

Switch to table view for detailed information:

- Sortable columns (title, author, rating, date)
- Bulk selection checkboxes
- Quick actions menu
- Compact display for large libraries

### Book Details

Click a book to view full details:

**Tabs:**
1. **Details** - All book information
2. **Similar Books** - Recommendations based on this book
3. **Reading History** - Session tracking (if enabled)

**Quick Actions:**
- Edit book information
- Update rating (click stars)
- Change status (dropdown)
- Delete book

## Organizing Books

### Statuses

Books can have different statuses:

| Status | Description |
|--------|-------------|
| **Read** | Finished books |
| **Currently Reading** | Books in progress |
| **Want to Read** | Wishlist/TBR pile |
| **Next** | Queued up to read next |
| **Parked** | Started but paused |
| **DNF** | Did Not Finish |

You can create custom statuses in **Settings → Statuses**.

### Genres

Organize books by genre:

- Built-in genres (Fiction, Non-Fiction, Fantasy, etc.)
- Create custom genres
- Assign colors and icons
- Filter library by genre

### Tags

Create flexible categorization with tags:

- **System Tags**: Favorite, Wishlist (always available)
- **Custom Tags**: Create your own
- **Bulk Tagging**: Apply tags to multiple books
- **Tag Colors**: Visual organization
- **Tag Icons**: Pick from icon library

**Examples:**
- Reading list tags: "Beach Reads", "Comfort Reads"
- Source tags: "Library", "Borrowed", "Gift"
- Challenge tags: "2026 Challenge", "Book Club"

### Series Tracking

Track reading order for series:

- Add books to series
- Set book numbers (supports decimals like 2.5 for novellas)
- Book number ranges for omnibus editions
- Primary series designation (for books in multiple series)
- Series status tracking
- Gap detection (see which books you're missing)

### Multi-Author Support

Books can have multiple authors with different roles:

**Author Roles:**
- Author
- Co-Author
- Editor
- Translator
- Illustrator
- Narrator (for audiobooks)

**Primary Author:** Designate the main author for sorting and display.

## Editing Books

### Quick Edit

Hover over a book card and click the **Edit** icon for quick access to:
- Rating
- Status
- Tags
- Reading dates

### Full Edit

Click a book, then **Edit** for complete editing:
- All fields editable
- Upload new cover
- Manage authors and roles
- Update series information
- Add/remove tags

### Bulk Edit

Select multiple books for bulk operations:

1. **Select books** (click checkboxes or "Select All")
2. **Choose operation:**
   - Update status
   - Add/remove tags
   - Add/remove authors
   - Set narrator
   - Update dates
   - Delete books

## Searching & Filtering

### Quick Search

The search bar at the top finds books by:
- Title
- Author name
- ISBN
- Series name
- Tags

**Autocomplete** suggests results as you type.

### Advanced Filtering

Use the filter panel to refine your view:

**Filter by:**
- Status (Read, Reading, etc.)
- Genre
- Format (Physical, Ebook, Audiobook)
- Tags
- Author
- Series
- Rating (minimum stars)
- Date range (read date, added date)

**Combine filters** for precise searches:
- Example: "Science Fiction books rated 4+ stars read in 2025"

### Sorting

Sort your library by:
- Title (A-Z or Z-A)
- Author name
- Rating (highest/lowest)
- Date added (newest/oldest)
- Date read (recent/oldest)
- Page count

## Smart Collections (Magic Shelves)

Create dynamic collections that automatically update:

### Creating a Smart Collection

1. Go to **Shelves** → **Create Smart Collection**
2. **Name your shelf** (e.g., "Recent Favorites")
3. **Add rules:**
   - Field (Status, Genre, Rating, etc.)
   - Operator (is, is not, contains, greater than, etc.)
   - Value
4. **Combine rules** with AND/OR logic
5. **Set display options:**
   - Sort order
   - Maximum items
   - Show on dashboard

### Example Smart Collections

**Recent Favorites:**
- Rating ≥ 4.5 stars
- Read date in last 6 months

**Unfinished Series:**
- Series is not complete
- Status is not "Want to Read"

**Quick Reads:**
- Page count ≤ 300
- Status is "Want to Read"
- Format is "Paperback" or "Ebook"

**5-Star Books:**
- Rating = 5 stars
- Sort by: Date Read (descending)

### Managing Smart Collections

- **Edit rules** anytime - collection updates automatically
- **Pin to dashboard** for quick access
- **Share publicly** (optional) via widgets
- **Export** as regular collection

## Cover Management

### Uploading Covers

1. Click book → **Edit**
2. Click **Upload Cover**
3. Select image file (JPG, PNG, WebP)
4. Crop/resize if desired
5. Save

### Automatic Cover Download

When adding books with metadata lookup:
- Cover images downloaded automatically
- Stored locally for fast loading
- Fallback to placeholder if unavailable

### Updating Covers

Replace existing covers:
1. Edit book
2. Click existing cover
3. Upload new image or enter URL

### Bulk Cover Download

Download covers for multiple books:
1. Admin → **Data Cleanup**
2. **Find Missing Covers**
3. Review books without covers
4. **Download All** to fetch from providers

## Deleting Books

### Single Book

1. Open book details
2. Click **Delete** (trash icon)
3. Confirm deletion

**Note:** This deletes the book record and associated ebook file if present. Cover images are removed from the database but remain in storage (for potential reuse).

### Bulk Delete

1. Select multiple books
2. Click **Bulk Actions** → **Delete**
3. Review list
4. Confirm deletion

**Warning:** This action cannot be undone. Consider exporting your library first!

## Tips & Best Practices

### Organization Strategies

1. **Use tags liberally** - They're flexible and searchable
2. **Set reading status** - Keep track of what's in progress
3. **Rate books promptly** - Capture your impression while fresh
4. **Add personal notes** - Future you will appreciate context
5. **Leverage Smart Collections** - Let BookShelf organize for you

### Maintenance

1. **Regular backups** - Export library monthly
2. **Update metadata** - Refresh old entries occasionally
3. **Clean up DNF books** - Note why you stopped
4. **Review duplicates** - Use Admin → Data Cleanup

### Reading Workflow

**Before Reading:**
1. Add to "Want to Read" status
2. Add to relevant tags (e.g., "2026 TBR")
3. Add to reading goal if applicable

**While Reading:**
1. Change status to "Currently Reading"
2. Set start date
3. Use ebook reader if digital
4. Add notes about thoughts

**After Reading:**
1. Change status to "Read"
2. Set completion date
3. Rate the book
4. Write review/comments
5. Add to reading goal progress

---

**Next:** Learn about [tracking your reading progress](tracking.html)
