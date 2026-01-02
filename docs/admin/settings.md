---
layout: default
title: Configuration & Settings
parent: Admin Guide
nav_order: 1
---

# Configuration & Settings

Configure BookShelf to match your preferences. Admin users access settings from **Admin** → **Settings**.

## General Settings

- **Library Name** - Display name shown in header
- **Branding** - Custom logos and favicon
- **Items Per Page** - Books per page (12-100)
- **Date Format** - US, EU, or ISO format
- **Default View** - Grid or list
- **Default Sort** - Title, author, rating, date

## Metadata Providers

Configure book metadata sources with priority ordering (1-6):

- Google Books
- Open Library
- Goodreads
- Hardcover (requires API key)
- Amazon
- ComicVine (requires API key for comics)

## OPDS Catalog

Serve library to e-reader apps like Calibre, KOReader, Moon+ Reader.

- **Enable OPDS** - Turn catalog on/off
- **Public Access** - Allow unauthenticated access
- **Catalog URL** - Auto-generated endpoint

## Email & Notifications

Configure SMTP for password resets and notifications:

- **SMTP Server** - Host, port, credentials
- **From Address** - Sender email
- **Test Email** - Verify configuration

## Advanced

- **BookDrop** - Auto-import ebooks from folder
- **AI Features** - OpenAI integration for recommendations
- **Widgets** - Embeddable stats for websites
- **Logging** - Log level and retention
- **Database** - Backup and maintenance options

See [Getting Started](../getting-started.html) for initial configuration.
