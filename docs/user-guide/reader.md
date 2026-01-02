---
layout: default
title: Ebook Reader
parent: User Guide
nav_order: 2
---

# Ebook Reader
{: .no_toc }

Read your digital books directly in BookShelf.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Supported Formats

BookShelf includes built-in readers for:

| Format | Type | Features |
|--------|------|----------|
| **EPUB** | Ebook | Reflowable text, themes, bookmarks, TOC navigation |
| **PDF** | Document | Page-based, zoom, scroll/page modes |
| **CBZ/CBR** | Comics | Image-based, page navigation, fit-to-screen |

## Opening a Book

### From Library

1. **Find your book** in the library
2. **Hover over cover** to reveal actions
3. **Click "Read"** button (book icon)
4. Reader opens in full-screen mode

### From Book Details

1. Open book details
2. Click **"Read Book"** button
3. If multiple formats available, choose preferred format

## EPUB Reader

### Interface

**Top Bar:**
- Book title
- Close button (returns to library)

**Reading Area:**
- Reflowable text that adapts to window size
- Swipe/click to turn pages
- Tap center to show/hide controls

**Bottom Controls:**
- Previous/Next chapter
- Progress slider
- Settings menu
- Table of Contents
- Bookmarks

### Navigation

**Page Turning:**
- **Click right** side of page → Next page
- **Click left** side → Previous page
- **Arrow keys** → ← / → to navigate
- **Swipe** left/right on touch devices

**Chapters:**
- Click **TOC** icon to see table of contents
- Click chapter name to jump directly

**Progress Bar:**
- Drag slider to jump to any position
- Shows percentage read

### Reading Settings

Click the **Settings** icon to customize:

**Theme:**
- Light (white background, black text)
- Dark (black background, white text)
- Sepia (beige background, brown text)
- Custom (define your own colors)

**Font Size:**
- Slider from small to extra large
- Or use keyboard: `+` / `-` keys

**Font Family:**
- Serif (traditional)
- Sans-serif (modern)
- OpenDyslexic (accessibility)
- System default

**Line Spacing:**
- Tight
- Normal
- Loose
- Extra loose

**Margins:**
- Narrow (more text per page)
- Normal
- Wide (easier on eyes)

**Text Alignment:**
- Left
- Justified

### Bookmarks

Save your place with bookmarks:

1. Click **Bookmark** icon (ribbon)
2. Bookmark added at current position
3. View all bookmarks in bookmarks panel
4. Click bookmark to jump to that location
5. Remove bookmarks with ✕ button

**Note:** Your reading position is auto-saved every few seconds.

### Progress Tracking

Your progress is automatically tracked:

- **Position saved** when you close the reader
- **Reading time** tracked per session
- **Percentage complete** shown in progress bar
- **Last read timestamp** updated

View reading history in book details → **Reading History** tab.

## PDF Reader

### Interface

**Toolbar:**
- Zoom controls (-, +, fit width, fit page)
- Page navigation (first, previous, next, last)
- Current page / total pages
- Search (find text in PDF)
- Download PDF
- Close reader

**Display Modes:**
- **Single Page** - One page at a time
- **Continuous Scroll** - All pages in sequence

### Navigation

**Pages:**
- Click **Previous/Next** buttons
- Use **arrow keys** ↑/↓
- Enter page number and press Enter
- Drag scrollbar

**Zoom:**
- Click **+ / -** buttons
- Use **Ctrl + mouse wheel**
- **Fit Width** - fills browser width
- **Fit Page** - shows entire page

**Search:**
- Click **Search** icon
- Enter text to find
- Navigate matches with arrows
- Highlights all matches on page

### PDF Settings

- **Zoom level** preserved between sessions
- **Display mode** preference saved
- **Last page** remembered

## Comic Reader (CBZ/CBR)

### Interface

**Reading Area:**
- Full-screen image display
- Minimal UI (tap to reveal controls)

**Controls:**
- Previous/Next page buttons
- Page counter (X of Y)
- Zoom and fit options
- Close reader

### Navigation

**Pages:**
- Click **left/right** edges
- Use **arrow keys** ← / →
- Swipe on touch devices

**Reading Direction:**
- Left-to-right (Western comics)
- Right-to-left (Manga)
- Settings remember your preference per book

### Display Options

**Fit Mode:**
- **Fit Width** - Image fills browser width
- **Fit Height** - Image fills browser height
- **Original Size** - Show actual resolution
- **Manual Zoom** - Ctrl + scroll to zoom

**Background:**
- Black (default)
- White
- Gray

## Keyboard Shortcuts

### Universal

| Key | Action |
|-----|--------|
| `Esc` | Close reader |
| `F` | Toggle fullscreen |
| `←` | Previous page |
| `→` | Next page |
| `Home` | First page |
| `End` | Last page |

### EPUB Only

| Key | Action |
|-----|--------|
| `+` / `=` | Increase font size |
| `-` / `_` | Decrease font size |
| `T` | Toggle TOC |
| `B` | Toggle bookmarks |
| `S` | Toggle settings |

### PDF Only

| Key | Action |
|-----|--------|
| `Ctrl` `+` | Zoom in |
| `Ctrl` `-` | Zoom out |
| `Ctrl` `0` | Reset zoom |
| `Ctrl` `F` | Search |
| `Page Up` | Scroll up |
| `Page Down` | Scroll down |

## Reading Sessions

BookShelf tracks your reading sessions:

**Automatically Recorded:**
- Start time (when you open reader)
- End time (when you close reader)
- Duration (active reading time)
- Pages/progress covered
- Book and format

**View Sessions:**
- Book details → **Reading History** tab
- See all your reading sessions
- Total time spent reading
- Reading pace (pages per hour)

**Statistics:**
- Sessions contribute to reading goals
- Used in reading heatmap
- Included in time-based statistics

## Uploading Ebooks

### Single Upload

1. Open book details
2. Click **"Upload Ebook"** button
3. Select file (EPUB, PDF, CBZ, CBR)
4. Wait for upload
5. **"Read"** button appears when done

### Bulk Upload via BookDrop

1. Enable BookDrop (Admin → BookDrop)
2. Drop multiple ebook files in watch folder
3. BookShelf creates books automatically
4. Files moved to ebooks library

### Replacing Ebooks

To replace an existing ebook file:
1. Book details → **Ebook** section
2. Click **"Replace File"**
3. Upload new file
4. Old file is replaced

## Removing Ebooks

Remove ebook file but keep book record:

1. Book details → **Ebook** section
2. Click **"Remove Ebook"**
3. Confirm deletion
4. File deleted, book record remains

## Tips & Best Practices

### Organizing Ebooks

1. **Use consistent naming** - Title by Author.epub
2. **Embed metadata** - Many tools can add metadata to EPUB
3. **Organize source files** - Keep originals backed up separately

### Reading Experience

**For Long Reading Sessions:**
- Use sepia theme to reduce eye strain
- Increase margins and line spacing
- Take breaks every 30-60 minutes

**For Difficult Books:**
- Increase font size
- Use bookmarks to mark important passages
- Add book notes about confusing sections

**For Speed Reading:**
- Use justified text
- Narrow margins for more text
- Track reading time to set pace goals

### Performance

**Large PDFs:**
- May take longer to load
- Consider converting to EPUB if reflowable
- Use search instead of scrolling through all pages

**Many Ebooks:**
- Ebook files stored locally
- Each file only loaded when opened
- Clean up unused ebooks to save space

### Troubleshooting

**Book Won't Open:**
- Check file format is supported
- Re-upload the file
- Try opening in another reader to verify file integrity

**Lost Reading Position:**
- Check browser didn't clear storage
- Position saved every 5 seconds
- Try re-opening book

**Text Too Small/Large:**
- Adjust font size in settings
- Changes persist for that book
- Reset settings to defaults if needed

**Pages Not Turning:**
- Ensure JavaScript is enabled
- Try keyboard shortcuts instead
- Reload the page

## Accessibility

### Screen Readers

- EPUB readers have ARIA labels
- Semantic HTML structure
- Keyboard navigation supported

### Font Options

- OpenDyslexic font available
- High contrast themes
- Adjustable sizes for visual impairment

### Keyboard Navigation

All reader functions accessible via keyboard:
- No mouse required
- Logical tab order
- Clear focus indicators

---

**Next:** Learn about [tracking your reading](tracking.html)
