/**
 * API v1 Info Endpoint
 * Returns API documentation and available endpoints
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	// Check if API is enabled (uses same setting as widgets)
	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	// Validate token
	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	return json({
		name: 'BookShelf API',
		version: 'v1',
		authentication: {
			method: 'Query parameter',
			parameter: 'token',
			description: 'Add ?token=YOUR_TOKEN to all requests. Get your token from Admin → Widgets.'
		},
		endpoints: {
			// Books
			'GET /api/v1/books': {
				description: 'List all books with full details',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0',
					status: 'optional, filter by status name',
					genre: 'optional, filter by genre name',
					author: 'optional, filter by author ID',
					series: 'optional, filter by series ID'
				},
				returns: '{ books: Book[], pagination: { total, limit, offset, hasMore } }'
			},
			'POST /api/v1/books': {
				description: 'Create a new book',
				body: {
					title: 'required, string',
					summary: 'optional, string',
					comments: 'optional, string',
					coverUrl: 'optional, string URL',
					rating: 'optional, number 0-5',
					pageCount: 'optional, integer',
					releaseDate: 'optional, ISO date string',
					startReadingDate: 'optional, ISO date string',
					completedDate: 'optional, ISO date string',
					isbn10: 'optional, string',
					isbn13: 'optional, string',
					asin: 'optional, string',
					publisher: 'optional, string',
					publishYear: 'optional, integer',
					language: 'optional, string',
					edition: 'optional, string',
					status: 'optional, status name (e.g., "Current", "Done")',
					statusId: 'optional, status ID (alternative to status)',
					genre: 'optional, genre name',
					genreId: 'optional, genre ID (alternative to genre)',
					format: 'optional, format name',
					formatId: 'optional, format ID (alternative to format)',
					authors: 'optional, array of { id, role?, isPrimary? }',
					series: 'optional, array of { id, bookNum?, bookNumEnd? }',
					tagIds: 'optional, array of tag IDs'
				},
				returns: '{ book: { id, title }, message }'
			},
			'GET /api/v1/books/:id': {
				description: 'Get a single book by ID with full details',
				params: { token: 'required' },
				returns: '{ book: Book }'
			},
			'PUT /api/v1/books/:id': {
				description: 'Update a book',
				body: 'Same as POST, all fields optional',
				returns: '{ book: { id, title }, message }'
			},
			'DELETE /api/v1/books/:id': {
				description: 'Delete a book',
				params: { token: 'required' },
				returns: '{ message }'
			},

			// Authors
			'GET /api/v1/authors': {
				description: 'List all authors with book counts',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0'
				},
				returns: '{ authors: Author[], pagination }'
			},
			'POST /api/v1/authors': {
				description: 'Create a new author',
				body: {
					name: 'required, string',
					bio: 'optional, string',
					birthDate: 'optional, ISO date string',
					deathDate: 'optional, ISO date string',
					birthPlace: 'optional, string',
					photoUrl: 'optional, string URL',
					website: 'optional, string URL',
					wikipediaUrl: 'optional, string URL',
					comments: 'optional, string'
				},
				returns: '{ author: { id, name }, message }'
			},
			'GET /api/v1/authors/:id': {
				description: 'Get a single author with their books',
				params: { token: 'required' },
				returns: '{ author: Author, books: Book[] }'
			},
			'PUT /api/v1/authors/:id': {
				description: 'Update an author',
				body: 'Same as POST, all fields optional',
				returns: '{ author: { id, name }, message }'
			},
			'DELETE /api/v1/authors/:id': {
				description: 'Delete an author',
				params: { token: 'required' },
				returns: '{ message }'
			},

			// Series
			'GET /api/v1/series': {
				description: 'List all series with book counts',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0'
				},
				returns: '{ series: Series[], pagination }'
			},
			'POST /api/v1/series': {
				description: 'Create a new series',
				body: {
					title: 'required, string',
					description: 'optional, string',
					numBooks: 'optional, integer',
					comments: 'optional, string'
				},
				returns: '{ series: { id, title }, message }'
			},
			'GET /api/v1/series/:id': {
				description: 'Get a single series with its books',
				params: { token: 'required' },
				returns: '{ series: Series, books: Book[] }'
			},
			'PUT /api/v1/series/:id': {
				description: 'Update a series',
				body: 'Same as POST, all fields optional',
				returns: '{ series: { id, title }, message }'
			},
			'DELETE /api/v1/series/:id': {
				description: 'Delete a series',
				params: { token: 'required' },
				returns: '{ message }'
			},

			// Lookups
			'GET /api/v1/statuses': {
				description: 'List all statuses',
				params: { token: 'required' },
				returns: '{ statuses: Status[] }'
			},
			'GET /api/v1/genres': {
				description: 'List all genres with book counts',
				params: { token: 'required' },
				returns: '{ genres: Genre[] }'
			},
			'GET /api/v1/formats': {
				description: 'List all formats with book counts',
				params: { token: 'required' },
				returns: '{ formats: Format[] }'
			},
			'GET /api/v1/tags': {
				description: 'List all tags with book counts',
				params: { token: 'required' },
				returns: '{ tags: Tag[] }'
			}
		},
		examples: {
			'List books with status filter': 'GET /api/v1/books?token=xxx&status=Current&limit=10',
			'Create a book': 'POST /api/v1/books?token=xxx with JSON body { "title": "My Book", "authors": [{ "id": 1 }] }',
			'Update a book rating': 'PUT /api/v1/books/123?token=xxx with JSON body { "rating": 4.5 }',
			'Delete a book': 'DELETE /api/v1/books/123?token=xxx'
		}
	});
};
