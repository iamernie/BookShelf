---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started
{: .no_toc }

Get BookShelf up and running in minutes.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Installation Methods

BookShelf V2 can be installed in several ways:

1. **Docker** (Recommended) - Easiest setup with minimal dependencies
2. **Docker Compose** - Full control over configuration
3. **Manual Installation** - For development or custom deployments

## Quick Start with Docker

The fastest way to get BookShelf running:

```bash
docker run -d \
  --name bookshelf \
  -p 3000:3000 \
  -v bookshelf-data:/data \
  -v bookshelf-covers:/app/static/covers \
  -v bookshelf-ebooks:/app/static/ebooks \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e ORIGIN=http://localhost:3000 \
  yourusername/bookshelf:latest
```

Then open **http://localhost:3000** in your browser.

## Docker Compose Setup

For a more permanent installation with easier management:

### 1. Create Project Directory

```bash
mkdir bookshelf && cd bookshelf
```

### 2. Download Docker Compose File

```bash
curl -O https://raw.githubusercontent.com/yourusername/BookShelfV2/main/docker-compose.yml
```

Or create it manually:

```yaml
version: '3.8'

services:
  bookshelf:
    image: yourusername/bookshelf:latest
    container_name: bookshelf
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - SESSION_SECRET=${SESSION_SECRET}
      - ORIGIN=${ORIGIN:-http://localhost:3000}
      - PORT=3000
      - DATABASE_PATH=/data/bookshelf.sqlite
      - PUID=${PUID:-1000}
      - PGID=${PGID:-1000}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
    volumes:
      - ./data:/data
      - ./covers:/app/static/covers
      - ./ebooks:/app/static/ebooks
      - ./logs:/logs
      - ./bookdrop:/app/bookdrop
```

### 3. Create Environment File

```bash
cat > .env << EOF
SESSION_SECRET=$(openssl rand -hex 32)
ORIGIN=http://localhost:3000
PUID=$(id -u)
PGID=$(id -g)
# Optional: Add OpenAI API key for AI recommendations
# OPENAI_API_KEY=sk-...
EOF
```

### 4. Start BookShelf

```bash
docker compose up -d
```

### 5. View Logs

```bash
docker compose logs -f
```

## First Time Setup

When you first access BookShelf, you'll be greeted with a setup wizard:

### 1. Create Admin Account

- Enter your desired username
- Set a strong password
- Provide your email address

### 2. Configure Basic Settings

- Set your library name
- Choose your preferred date format
- Select default language

### 3. Start Adding Books!

You're ready to build your library.

## Environment Variables

Configure BookShelf with these environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | **Yes** | - | Random string for session encryption (use `openssl rand -hex 32`) |
| `ORIGIN` | **Yes** | `http://localhost:3000` | Your server's public URL |
| `PORT` | No | `3000` | Server port |
| `DATABASE_PATH` | No | `/data/bookshelf.sqlite` | SQLite database location |
| `PUID` / `PGID` | No | `1000` | User/group ID for file permissions (Docker only) |
| `OPENAI_API_KEY` | No | - | OpenAI API key for AI recommendations |
| `LOG_LEVEL` | No | `info` | Logging level: `debug`, `info`, `warn`, `error` |

### Finding Your UID/GID

On Linux/Mac:
```bash
id -u  # Shows your UID
id -g  # Shows your GID
```

## Volume Mappings

BookShelf uses these directories:

| Container Path | Purpose | Recommended Host Path |
|----------------|---------|----------------------|
| `/data` | SQLite database | `./data` |
| `/logs` | Application logs | `./logs` |
| `/app/static/covers` | Book cover images | `./covers` |
| `/app/static/ebooks` | Uploaded ebook files | `./ebooks` |
| `/app/bookdrop` | Auto-import folder (optional) | `./bookdrop` |

## Port Configuration

By default, BookShelf runs on port 3000. To use a different port:

**Docker:**
```bash
docker run -p 8080:3000 ...
```

**Docker Compose:**
```yaml
ports:
  - "8080:3000"  # Host:Container
```

**Access at:** `http://localhost:8080`

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name books.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Update `ORIGIN` in your `.env`:
```env
ORIGIN=https://books.example.com
```

### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.bookshelf.rule=Host(`books.example.com`)"
  - "traefik.http.routers.bookshelf.entrypoints=websecure"
  - "traefik.http.routers.bookshelf.tls.certresolver=letsencrypt"
  - "traefik.http.services.bookshelf.loadbalancer.server.port=3000"
```

## Manual Installation (Development)

For local development or custom deployments:

### Prerequisites

- Node.js 18+ and npm
- Git

### Steps

```bash
# 1. Clone repository
git clone https://github.com/yourusername/BookShelfV2.git
cd BookShelfV2

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your settings

# 4. Build the application
npm run build

# 5. Start the server
npm start
```

For development with hot-reload:
```bash
npm run dev
```

Access at **http://localhost:5173** (Vite dev server)

## Updating BookShelf

### Docker

```bash
docker pull yourusername/bookshelf:latest
docker stop bookshelf
docker rm bookshelf
# Run your docker run command again
```

### Docker Compose

```bash
docker compose pull
docker compose up -d
```

Your data is preserved in volumes, so updates are safe!

## Troubleshooting

### Can't Access BookShelf

**Check if container is running:**
```bash
docker ps
```

**Check logs:**
```bash
docker logs bookshelf
```

### Permission Issues

Make sure PUID/PGID match your user:
```bash
id -u && id -g
```

Update your `.env` file and restart.

### Database Errors

If you see database errors after an update:
```bash
# Backup first!
cp data/bookshelf.sqlite data/bookshelf.sqlite.backup

# Then restart - migrations run automatically
docker compose restart
```

## Next Steps

Now that BookShelf is running:

1. [Add your first books](user-guide/books.html)
2. [Configure metadata providers](user-guide/metadata.html)
3. [Set up reading goals](user-guide/goals.html)
4. [Explore the ebook reader](user-guide/reader.html)

---

Need help? Check the [FAQ](faq.html) or [open an issue](https://github.com/yourusername/BookShelfV2/issues).
