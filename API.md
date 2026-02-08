# BookShelf API Documentation

This document describes the BookShelf REST API for external integrations.

## Authentication

BookShelf supports two authentication methods:

### 1. API Token (Recommended for Integrations)

Generate an API token from **Account → API Tokens** in the web interface.

Include the token in your requests using the `Authorization` header:

```http
Authorization: Bearer bks_your_token_here
```

### 2. Session Cookie

For browser-based access, session cookies are automatically used after login.

---

## API Token Management

### List Tokens

Get all API tokens for the authenticated user.

```http
GET /api/tokens
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "My Integration",
    "tokenPrefix": "bks_abc12345",
    "permissions": null,
    "lastUsedAt": "2026-02-08T10:30:00.000Z",
    "expiresAt": null,
    "createdAt": "2026-02-01T09:00:00.000Z"
  }
]
```

### Create Token

Create a new API token.

```http
POST /api/tokens
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My New Token",
  "expiresAt": "2027-01-01T00:00:00.000Z"  // optional
}
```

**Response (201 Created):**
```json
{
  "token": "bks_abc123def456...",
  "id": 2,
  "name": "My New Token",
  "tokenPrefix": "bks_abc123de",
  "permissions": null,
  "lastUsedAt": null,
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "createdAt": "2026-02-08T12:00:00.000Z"
}
```

> **Important:** The full token is only returned once upon creation. Store it securely.

### Get Token

Get details of a specific token.

```http
GET /api/tokens/:id
Authorization: Bearer <token>
```

### Update Token

Update a token's name.

```http
PUT /api/tokens/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Revoke Token

Revoke a specific token.

```http
DELETE /api/tokens/:id
Authorization: Bearer <token>
```

### Revoke All Tokens

Revoke all tokens for the authenticated user.

```http
DELETE /api/tokens
Authorization: Bearer <token>
```

---

## Books

### List Books

Get a paginated list of books.

```http
GET /api/books
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 24, max: 100) |
| `q` | string | Search query (searches title, author) |
| `status` | number | Filter by status ID |
| `genre` | number | Filter by genre ID |
| `author` | number | Filter by author ID |
| `series` | number | Filter by series ID |
| `sort` | string | Sort field (title, author, rating, createdAt, etc.) |
| `order` | string | Sort order (asc, desc) |

**Response:**
```json
{
  "books": [
    {
      "id": 1,
      "title": "The Great Gatsby",
      "rating": 4.5,
      "coverImageUrl": "/covers/1.jpg",
      "statusId": 1,
      "genreId": 2,
      "pageCount": 180,
      "authors": [{ "id": 1, "name": "F. Scott Fitzgerald" }],
      "series": [{ "id": 1, "title": "Classics", "bookNum": 1 }]
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 7
}
```

### Get Book

Get a single book by ID.

```http
GET /api/books/:id
Authorization: Bearer <token>
```

### Create Book

Add a new book.

```http
POST /api/books
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "New Book Title",
  "authorIds": [1, 2],
  "genreId": 3,
  "statusId": 1,
  "rating": 4,
  "pageCount": 300,
  "isbn13": "9781234567890"
}
```

### Update Book

Update an existing book.

```http
PUT /api/books/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "rating": 5
}
```

### Delete Book

Delete a book.

```http
DELETE /api/books/:id
Authorization: Bearer <token>
```

---

## Authors

### List Authors

```http
GET /api/authors
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `q` | string | Search by name |

### Get Author

```http
GET /api/authors/:id
Authorization: Bearer <token>
```

### Create Author

```http
POST /api/authors
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Author Name",
  "bio": "Author biography...",
  "website": "https://author.com"
}
```

### Update Author

```http
PUT /api/authors/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Author

```http
DELETE /api/authors/:id
Authorization: Bearer <token>
```

---

## Series

### List Series

```http
GET /api/series
Authorization: Bearer <token>
```

### Get Series

```http
GET /api/series/:id
Authorization: Bearer <token>
```

### Create Series

```http
POST /api/series
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Series Title",
  "description": "Series description..."
}
```

### Update Series

```http
PUT /api/series/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title"
}
```

### Delete Series

```http
DELETE /api/series/:id
Authorization: Bearer <token>
```

---

## Genres

### List Genres

```http
GET /api/genres
Authorization: Bearer <token>
```

### Get Genre

```http
GET /api/genres/:id
Authorization: Bearer <token>
```

---

## Statuses

### List Statuses

```http
GET /api/statuses
Authorization: Bearer <token>
```

Returns available book reading statuses (e.g., "To Read", "Reading", "Done").

---

## Tags

### List Tags

```http
GET /api/tags
Authorization: Bearer <token>
```

### Get Tag

```http
GET /api/tags/:id
Authorization: Bearer <token>
```

### Create Tag

```http
POST /api/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tag Name",
  "color": "#ff5733"
}
```

---

## Reading Sessions

Track reading activity.

### List Reading Sessions

```http
GET /api/reading-sessions
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bookId` | number | Filter by book |
| `from` | string | Start date (ISO 8601) |
| `to` | string | End date (ISO 8601) |

### Create Reading Session

```http
POST /api/reading-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookId": 1,
  "startedAt": "2026-02-08T10:00:00.000Z",
  "endedAt": "2026-02-08T11:30:00.000Z",
  "pagesRead": 50
}
```

---

## Reading Goals

### List Goals

```http
GET /api/goals
Authorization: Bearer <token>
```

### Get Goal

```http
GET /api/goals/:id
Authorization: Bearer <token>
```

### Create Goal

```http
POST /api/goals
Authorization: Bearer <token>
Content-Type: application/json

{
  "year": 2026,
  "targetBooks": 52,
  "challengeType": "books"
}
```

---

## Dashboard Statistics

### Get Dashboard Stats

```http
GET /api/dashboard/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalBooks": 250,
  "booksRead": 45,
  "booksReading": 3,
  "pagesRead": 12500,
  "readingStreak": 7
}
```

### Get Reading Activity

```http
GET /api/dashboard/activity
Authorization: Bearer <token>
```

Returns reading activity data for charts.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "message": "Error description"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently, there are no rate limits on the API. This may change in future versions.

---

## Examples

### cURL

```bash
# Get all books
curl -H "Authorization: Bearer bks_your_token_here" \
  https://your-bookshelf.com/api/books

# Add a new book
curl -X POST \
  -H "Authorization: Bearer bks_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Book", "authorIds": [1]}' \
  https://your-bookshelf.com/api/books
```

### Python

```python
import requests

API_TOKEN = "bks_your_token_here"
BASE_URL = "https://your-bookshelf.com"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Get all books
response = requests.get(f"{BASE_URL}/api/books", headers=headers)
books = response.json()

# Add a new book
new_book = {
    "title": "My New Book",
    "authorIds": [1],
    "statusId": 2
}
response = requests.post(f"{BASE_URL}/api/books", json=new_book, headers=headers)
```

### JavaScript/Node.js

```javascript
const API_TOKEN = 'bks_your_token_here';
const BASE_URL = 'https://your-bookshelf.com';

// Get all books
const response = await fetch(`${BASE_URL}/api/books`, {
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`
  }
});
const { books } = await response.json();

// Add a new book
const newBook = await fetch(`${BASE_URL}/api/books`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My New Book',
    authorIds: [1],
    statusId: 2
  })
});
```

---

## Changelog

- **v2.7.0** - Added API Token authentication system
