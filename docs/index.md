---
layout: default
title: Home
nav_order: 1
---

# BookShelf V2 Documentation

Welcome to **BookShelf V2** – your personal book library management system.

{: .fs-6 .fw-300 }
A self-hosted web application for book lovers who want to track their reading, organize their digital library, and discover patterns in their reading habits.

[Get Started](getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/yourusername/BookShelfV2){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## What is BookShelf?

BookShelf is a feature-rich, self-hosted book library manager that helps you:

- 📚 **Organize your collection** with tags, genres, series, and smart collections
- 📖 **Read your ebooks** with a built-in reader for EPUB, PDF, and comics
- 📊 **Track your reading** with goals, challenges, and beautiful statistics
- 🔍 **Discover new books** with recommendations and metadata fetching
- 🌐 **Access anywhere** with OPDS catalog support for e-reader apps

## Key Features

### Library Management
- Add books manually or import from Goodreads, Audible, or CSV
- Organize with customizable tags, genres, and series tracking
- Smart Collections (Magic Shelves) that auto-populate based on rules
- Multi-author support with roles (author, co-author, editor, translator, illustrator)

### Built-in Ebook Reader
- Support for EPUB, PDF, and CBZ/comic formats
- Reading progress automatically saved
- Customizable themes (light, dark, sepia)
- Bookmarks and zoom controls
- Reading sessions tracked for statistics

### Reading Tracking & Goals
- Set reading goals: books per year, pages per month, genre exploration
- 6 challenge types: total books, genre-specific, author challenges, format goals, page counts, monthly targets
- Reading heatmap (GitHub-style contribution graph for books!)
- Track your reading streaks

### Metadata & Discovery
- Automatic metadata fetching from 6 providers: Google Books, Open Library, Goodreads, Hardcover, Amazon, ComicVine
- Author biographies from Wikipedia and Speculative Fiction Fandom
- Similar book recommendations based on shared authors, series, and genres
- AI-powered recommendations (optional OpenAI integration)

### Modern Interface
- Responsive design for desktop and mobile
- Dark mode with system preference detection
- Quick actions on book cards (read, view, edit)
- Inline editing for quick updates
- Collapsible sidebar for focused reading

### Multi-User Support
- User roles: admin, member
- Personal libraries with shared access options
- Public library for bulk imports
- OPDS catalog for e-reader apps (Calibre, KOReader, Moon+ Reader)

### Import & Export
- Import from Goodreads CSV
- Import from Audible library HTML
- Bulk CSV import with preview
- Full JSON backup and restore
- BookDrop folder watching for automatic imports

## Technology Stack

BookShelf V2 is built with modern web technologies:

- **Frontend**: SvelteKit 2, Svelte 5 (with runes), TailwindCSS
- **Backend**: SvelteKit API routes
- **Database**: SQLite with Drizzle ORM
- **Reader**: epub.js, PDF.js, JSZip
- **Deployment**: Docker with multi-architecture support

## Screenshots

*Coming soon! Check back for visual guides and interface previews.*

## Getting Started

Ready to set up your own BookShelf? Head over to the [Getting Started](getting-started) guide for installation instructions.

## Need Help?

- 📖 Browse the [User Guide](user-guide/) for detailed features
- 🔧 Check the [Admin Guide](admin/) for configuration and management
- 🐛 Found a bug? [Open an issue](https://github.com/yourusername/BookShelfV2/issues)
- 💡 Have a feature idea? We'd love to hear it!

## License

BookShelf V2 is released under the MIT License. Do what you want, just don't blame us if it eats your homework.

---

**Happy Reading!** 📚✨
