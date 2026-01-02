# BookShelf V2 - Personal Book Management Application
# https://github.com/iamernie/BookShelfV2

# Use Node.js 20 LTS (Alpine for smaller image)
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source
COPY . .

# Set body size limit for large file uploads (500MB for audiobooks)
ENV BODY_SIZE_LIMIT=500M

# Build the SvelteKit application
RUN npm run build

# Production stage
FROM node:20-alpine

# Set labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/iamernie/BookShelfV2"
LABEL org.opencontainers.image.description="BookShelf V2 - A self-hosted personal book management application"
LABEL org.opencontainers.image.licenses="MIT"

# Install su-exec for running as non-root user
# su-exec is a minimal alternative to gosu for Alpine
RUN apk add --no-cache su-exec

# Create app directory
WORKDIR /app

# Create data directories for persistent storage
# These should be mounted as volumes
RUN mkdir -p /data /logs /app/static/covers /app/static/ebooks /app/data/audiobooks

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy static assets
COPY --from=builder /app/static ./static

# Copy CHANGELOG.md for What's New modal
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md

# Keep a backup of placeholder.png (volumes will overwrite static/covers)
RUN cp /app/static/placeholder.png /app/placeholder.png.default

# Copy entrypoint script
COPY docker-entrypoint.sh ./

# Copy utility scripts
COPY scripts ./scripts

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

# Create symlinks for persistent data
# Database will be stored in /data, logs in /logs
RUN ln -sf /logs /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=http://localhost:3000
# Default PUID/PGID (can be overridden at runtime)
ENV PUID=1000
ENV PGID=1000

# Expose the application port
EXPOSE 3000

# Health check - verify the app is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use entrypoint script to handle user permissions
ENTRYPOINT ["/app/docker-entrypoint.sh"]
