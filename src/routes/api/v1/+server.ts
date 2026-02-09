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
		endpoints: {
			'/api/v1': {
				method: 'GET',
				description: 'API documentation (this endpoint)',
				params: { token: 'required' }
			},
			'/api/v1/books': {
				method: 'GET',
				description: 'List all books with full details',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0',
					status: 'optional, filter by status name',
					genre: 'optional, filter by genre name',
					author: 'optional, filter by author ID',
					series: 'optional, filter by series ID'
				}
			},
			'/api/v1/books/[id]': {
				method: 'GET',
				description: 'Get a single book by ID with full details',
				params: { token: 'required' }
			},
			'/api/v1/authors': {
				method: 'GET',
				description: 'List all authors with book counts',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0'
				}
			},
			'/api/v1/authors/[id]': {
				method: 'GET',
				description: 'Get a single author by ID with their books',
				params: { token: 'required' }
			},
			'/api/v1/series': {
				method: 'GET',
				description: 'List all series with book counts',
				params: {
					token: 'required',
					limit: 'optional, default 50, max 500',
					offset: 'optional, default 0'
				}
			},
			'/api/v1/series/[id]': {
				method: 'GET',
				description: 'Get a single series by ID with its books',
				params: { token: 'required' }
			},
			'/api/v1/statuses': {
				method: 'GET',
				description: 'List all statuses',
				params: { token: 'required' }
			},
			'/api/v1/genres': {
				method: 'GET',
				description: 'List all genres',
				params: { token: 'required' }
			},
			'/api/v1/formats': {
				method: 'GET',
				description: 'List all formats',
				params: { token: 'required' }
			},
			'/api/v1/tags': {
				method: 'GET',
				description: 'List all tags',
				params: { token: 'required' }
			}
		}
	});
};
