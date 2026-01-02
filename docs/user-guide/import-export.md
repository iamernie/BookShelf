---
layout: default
title: Import & Export
parent: User Guide
nav_order: 4
---

# Import & Export
{: .no_toc }

Move your data in and out of BookShelf easily.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Importing Books

### CSV Import

Import books from CSV files (including Goodreads exports):

#### Step 1: Prepare CSV

Your CSV should have columns like:
- Title (required)
- Author / Authors
- ISBN / ISBN13
- Rating (0-5)
- Date Read
- Bookshelves (for tags)
- My Rating
- Book Id (for external IDs)

**Goodreads Export:**
1. Go to Goodreads → My Books
2. Bottom of page: "Import and export"
3. Click "Export Library"
4. Download CSV file

#### Step 2: Preview Import

1. Navigate to **Import/Export**
2. Select **"CSV Import"**
3. Upload your CSV file
4. Click **"Preview Import"**

BookShelf shows:
- Total rows found
- Columns detected
- Sample of first 10 rows
- Any errors or warnings

#### Step 3: Map Columns

Match CSV columns to BookShelf fields:

| CSV Column | BookShelf Field |
|------------|-----------------|
| Title | Title |
| Author | Authors |
| ISBN | ISBN |
| My Rating | Rating |
| Date Read | Completed Date |
| Bookshelves | Tags |

Unmapped columns are ignored.

#### Step 4: Configure Options

**Import Settings:**
- **Skip duplicates** (by title + author match)
- **Update existing** books if found
- **Create missing authors** automatically
- **Create missing tags** from bookshelves column
- **Fetch metadata** for books with ISBN
- **Download covers** from providers

#### Step 5: Execute Import

Click **"Import Now"**

Progress shown:
- Books processed: X/Y
- Created: N
- Updated: M
- Skipped: K
- Errors: L (with details)

#### Step 6: Review Results

Import summary shows:
- Successfully imported books
- Books with errors (with reasons)
- New authors created
- New tags created

Click **"View Imported Books"** to see them.

### Audible Import

Import your Audible library:

#### Step 1: Get Audible Library HTML

1. Go to Audible.com
2. Navigate to **Library**
3. Right-click page → **Save As** → Save complete HTML
4. Or use browser's "Print → Save as PDF" (HTML preferred)

#### Step 2: Upload to BookShelf

1. **Import/Export** → **Audible Import**
2. Upload saved HTML file
3. Click **"Parse Library"**

BookShelf extracts:
- Book titles
- Authors
- Narrators
- ASINs (Amazon IDs)
- Series information
- Length/duration

#### Step 3: Preview

Review parsed books:
- Check data accuracy
- See which books will be imported
- Identify duplicates

#### Step 4: Configure

**Settings:**
- Set format to "Audiobook" automatically
- Fetch metadata using ASIN
- Download covers
- Skip books already in library

#### Step 5: Import

Click **"Import Books"**

Books added with:
- Narrator information
- Audiobook format
- ASIN for Amazon linking

### Goodreads API Import

**Note:** Goodreads API is deprecated. Use CSV export instead.

### LibraryThing Import

Export from LibraryThing as CSV, then use CSV import.

### Calibre Import

#### Export from Calibre

1. Open Calibre
2. Select books to export
3. Right-click → **Save to disk**
4. **Export Format:** CSV
5. Save file

#### Import to BookShelf

Use CSV import with:
- Title, Authors, ISBN columns mapped
- Enable "Fetch metadata"
- Enable "Download covers"

### JSON Import (Full Backup Restore)

Restore a complete BookShelf backup:

1. **Import/Export** → **Restore from JSON**
2. Upload JSON backup file
3. Choose restore mode:
   - **Replace all** (deletes existing library)
   - **Merge** (adds new, updates existing)
4. Click **"Restore"**

**Warning:** "Replace all" is destructive!

### BookDrop (Automatic Import)

Drop ebook files in a folder for automatic import:

#### Setup

1. **Admin** → **BookDrop**
2. **Enable BookDrop**
3. Set watch folder path (default: `/app/bookdrop`)

#### Usage

1. Copy ebook files (EPUB, PDF, CBZ) to watch folder
2. BookShelf automatically:
   - Detects new files
   - Extracts metadata (title, author from file)
   - Tries to find ISBN/metadata online
   - Creates book entry
   - Moves file to ebooks folder
   - Sends notification

#### File Naming

For best results, name files:
- `Title by Author.epub`
- `Author - Title.epub`
- `Title (Year).pdf`

BookShelf parses the filename to extract title and author.

#### Monitoring

**BookDrop Dashboard:**
- Files pending import
- Recently imported
- Import errors
- Processing queue

#### Troubleshooting

**File not imported:**
- Check file format (must be EPUB, PDF, or CBZ)
- Verify permissions on watch folder
- Check BookDrop is enabled
- Review logs in Admin → Console

## Exporting Books

### CSV Export

Export your library as CSV:

1. **Import/Export** → **Export CSV**
2. Choose what to export:
   - **All books**
   - **Filtered books** (use current filters)
   - **Selected books** (from selection)
3. Select columns to include:
   - Basic info (title, author, ISBN)
   - Ratings and dates
   - Tags and series
   - Custom fields
4. Click **"Export CSV"**

CSV downloads immediately.

**Use Cases:**
- Backup
- Import to spreadsheet for analysis
- Share reading list
- Print catalog
- Migrate to another system

### JSON Backup

Complete backup of all data:

1. **Import/Export** → **Backup to JSON**
2. Choose backup type:
   - **Full backup** (all data including settings)
   - **Library only** (just books and related data)
3. Click **"Create Backup"**

JSON file downloads.

**Includes:**
- All books with complete metadata
- Authors, series, genres, tags
- Reading goals and progress
- User preferences
- Settings (full backup only)

**Does NOT include:**
- Cover image files (paths stored, files separate)
- Ebook files (paths stored, files separate)
- User passwords (for security)

**Best Practice:** Backup monthly or before major changes.

### Exporting Covers

Export cover images separately:

1. **Admin** → **Data Cleanup**
2. **Export Covers**
3. Choose format:
   - **ZIP archive** (all covers)
   - **Folder structure** (organized by author/title)
4. Download

### Exporting Ebooks

Ebooks stored in `/app/static/ebooks` directory:
- Access via file browser
- Copy entire directory for backup
- Or use Docker volume backup

**Docker Volume Backup:**
```bash
docker run --rm \
  -v bookshelf-ebooks:/source \
  -v $(pwd):/backup \
  alpine tar czf /backup/ebooks-backup.tar.gz -C /source .
```

## Bulk Operations

### Bulk Status Update

1. Select multiple books (checkboxes)
2. Click **"Bulk Actions"**
3. Choose **"Update Status"**
4. Select new status
5. Optionally set completion date
6. Apply changes

### Bulk Tag Add/Remove

1. Select books
2. **Bulk Actions** → **Manage Tags**
3. Choose operation:
   - **Add tags** (adds to existing)
   - **Remove tags** (removes specific)
   - **Replace tags** (removes all, adds new)
4. Select tags
5. Apply

### Bulk Delete

1. Select books to delete
2. **Bulk Actions** → **Delete Books**
3. Review list
4. Confirm deletion

**Warning:** Cannot be undone!

### Bulk Metadata Update

1. Select books
2. **Bulk Actions** → **Update Metadata**
3. BookShelf fetches fresh metadata for each
4. Choose which fields to update
5. Apply changes

## Migration Guides

### From BookShelf V1

V1 databases are compatible:

1. Copy V1 `database.sqlite` file
2. Place in V2 `/data` folder
3. Start BookShelf V2
4. Migrations run automatically
5. Verify data in V2

**What's Migrated:**
- All books with metadata
- Authors, series, genres
- Tags and statuses
- Reading goals

**Manual Steps:**
- Copy cover images to new covers folder
- Copy ebook files to new ebooks folder
- Update file paths in database if needed

### From Goodreads

1. Export Goodreads CSV
2. Import using CSV Import
3. Review imported books
4. Fetch missing metadata
5. Download covers

**Tips:**
- Goodreads "Exclusive Shelf" maps to BookShelf status
- "Bookshelves" become tags
- "My Rating" maps to rating (0-5 stars)

### From Calibre

1. Export Calibre library as CSV
2. Copy ebook files to BookShelf ebooks folder
3. Import CSV (maps file paths)
4. Or use BookDrop for ebook auto-import

**Note:** Calibre's custom columns not imported (map to tags/notes manually)

### From LibraryThing

1. Export as CSV or JSON
2. Import to BookShelf
3. LT tags → BookShelf tags
4. Ratings preserved

### From Notion/Spreadsheet

1. Export as CSV
2. Ensure columns: Title, Author, Rating, Read Date
3. Import via CSV Import
4. Map columns appropriately

## Scheduled Backups

Automate backups with cron/scheduled tasks:

### Docker Setup

Create backup script:

```bash
#!/bin/bash
# backup-bookshelf.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="/path/to/backups"

# Backup database
docker exec bookshelf sqlite3 /data/bookshelf.sqlite ".backup '/data/backup-$DATE.sqlite'"
docker cp bookshelf:/data/backup-$DATE.sqlite $BACKUP_DIR/

# Backup covers
docker run --rm \
  -v bookshelf-covers:/source \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/covers-$DATE.tar.gz -C /source .

# Backup ebooks
docker run --rm \
  -v bookshelf-ebooks:/source \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/ebooks-$DATE.tar.gz -C /source .

# Clean up old backups (keep 30 days)
find $BACKUP_DIR -name "*.sqlite" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-bookshelf.sh
```

## Tips & Best Practices

### Regular Backups

1. **Weekly JSON export** - Quick recovery
2. **Monthly full backup** - Database + files
3. **Before major changes** - Safety net
4. **After bulk imports** - Preserve work

### Import Preparation

**Clean Your Data:**
- Remove duplicate rows
- Standardize author names
- Consistent date formats
- Valid ISBNs (10 or 13 digits)

**Test First:**
- Import small sample (10 books)
- Verify data accuracy
- Adjust mappings if needed
- Then import full library

### Data Integrity

**After Import:**
- Check book count matches expected
- Verify random sample of books
- Ensure covers loaded
- Test search and filters

**Regular Maintenance:**
- Admin → Data Cleanup
- Find duplicates
- Find missing covers
- Sanitize data (fix encoding issues)

---

**Next:** Learn about [administration and settings](../admin/)
