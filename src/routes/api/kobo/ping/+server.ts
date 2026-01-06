/**
 * Kobo Ping Endpoint
 *
 * GET /api/kobo/ping
 *
 * Simple endpoint to test if Kobo devices can reach the server.
 * No authentication required - just returns a simple JSON response.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	// Log all requests for debugging
	console.log('[Kobo Ping]', {
		timestamp: new Date().toISOString(),
		userAgent: request.headers.get('user-agent'),
		deviceId: request.headers.get('x-kobo-deviceid'),
		accept: request.headers.get('accept'),
		headers: Object.fromEntries(request.headers.entries())
	});

	return json(
		{
			status: 'ok',
			message: 'BookShelf Kobo API is reachable',
			timestamp: new Date().toISOString()
		},
		{
			headers: {
				'x-kobo-apitoken': 'e30='
			}
		}
	);
};
