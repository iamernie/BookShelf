#!/bin/sh
# BookShelf V2 Docker Entrypoint
# Handles PUID/PGID for proper file ownership

set -e

# Get version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# Default to UID/GID 1000 if not specified
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "============================================"
echo "  BookShelf V2 - v${VERSION}"
echo "============================================"
echo "Starting with UID: $PUID, GID: $PGID"

# Find or create a group with the target GID
EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1 || true)

if [ -n "$EXISTING_GROUP" ]; then
    # Use existing group with this GID
    TARGET_GROUP="$EXISTING_GROUP"
    echo "Using existing group '$TARGET_GROUP' with GID $PGID"
else
    # Create new group
    TARGET_GROUP="bookshelf"
    addgroup -g "$PGID" "$TARGET_GROUP"
    echo "Created group '$TARGET_GROUP' with GID $PGID"
fi

# Find or create a user with the target UID
EXISTING_USER=$(getent passwd "$PUID" | cut -d: -f1 || true)

if [ -n "$EXISTING_USER" ]; then
    # Use existing user with this UID
    TARGET_USER="$EXISTING_USER"
    echo "Using existing user '$TARGET_USER' with UID $PUID"
else
    # Create new user
    TARGET_USER="bookshelf"
    adduser -D -u "$PUID" -G "$TARGET_GROUP" -h /app -s /bin/sh "$TARGET_USER" 2>/dev/null || true
    echo "Created user '$TARGET_USER' with UID $PUID"
fi

# Copy placeholder.png if it doesn't exist (volumes overwrite the directory)
if [ ! -f /app/static/placeholder.png ]; then
    echo "Copying placeholder.png to static directory..."
    cp /app/placeholder.png.default /app/static/placeholder.png
fi

# Ensure placeholder.png exists in covers directory too (for direct access)
if [ ! -f /app/static/covers/placeholder.png ]; then
    echo "Copying placeholder.png to covers directory..."
    cp /app/placeholder.png.default /app/static/covers/placeholder.png
fi

# Ensure uploads temp directory exists
mkdir -p /app/static/uploads/temp

# Ensure audiobooks directory exists
mkdir -p /app/data/audiobooks

# Set ownership on data directories
echo "Setting ownership on data directories..."
chown -R "$PUID:$PGID" /data /logs /app/static/covers /app/static/ebooks /app/static/uploads /app/data/audiobooks 2>/dev/null || true

# Also ensure the app directory is accessible
chown "$PUID:$PGID" /app 2>/dev/null || true

# Run the SvelteKit application as the target user
# BODY_SIZE_LIMIT must be set at runtime for SvelteKit adapter-node
# Default to 500MB for large audiobook uploads
BODY_SIZE_LIMIT=${BODY_SIZE_LIMIT:-500M}
export BODY_SIZE_LIMIT

echo "Starting SvelteKit application..."
echo "Body size limit: $BODY_SIZE_LIMIT"

# Use env to ensure BODY_SIZE_LIMIT is passed to the node process
exec su-exec "$PUID:$PGID" env BODY_SIZE_LIMIT="$BODY_SIZE_LIMIT" node build
