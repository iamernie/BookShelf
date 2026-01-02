# BookShelf Documentation

This directory contains the user documentation website for BookShelf, built with Jekyll and the Just the Docs theme.

## Viewing Locally

### Prerequisites

- Ruby 3.1+
- Bundler

### Setup

```bash
cd docs
bundle install
```

### Run Local Server

```bash
bundle exec jekyll serve
```

Visit http://localhost:4000

### Build Static Site

```bash
bundle exec jekyll build
```

Output in `_site/` directory.

## Documentation Structure

```
docs/
├── index.md              # Home page
├── getting-started.md    # Installation guide
├── user-guide.md         # User guide index
├── user-guide/
│   ├── books.md         # Managing books
│   ├── reader.md        # Ebook reader
│   ├── tracking.md      # Goals & statistics
│   └── import-export.md # Data import/export
├── admin.md             # Admin guide index
├── admin/
│   └── settings.md      # Configuration
├── faq.md               # FAQ
└── _config.yml          # Jekyll configuration
```

## Adding New Pages

1. Create markdown file in appropriate directory
2. Add frontmatter:

```yaml
---
layout: default
title: Page Title
parent: Parent Page  # Optional
nav_order: 1         # Order in navigation
---
```

3. Content in Markdown
4. Commit and push (auto-deploys to GitHub Pages)

## Theme

Using [Just the Docs](https://just-the-docs.github.io/just-the-docs/) theme.

Features:
- Search
- Navigation sidebar
- Mobile responsive
- Dark mode
- Code highlighting

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to `main` branch.

Configure in repository settings:
- Settings → Pages
- Source: GitHub Actions

Documentation will be available at:
`https://yourusername.github.io/BookShelfV2/`

## Contributing

To improve documentation:
1. Fork repository
2. Make changes in `docs/` directory
3. Test locally with `bundle exec jekyll serve`
4. Submit pull request

Keep documentation:
- Clear and concise
- Beginner-friendly
- Up-to-date with features
- Well-organized
