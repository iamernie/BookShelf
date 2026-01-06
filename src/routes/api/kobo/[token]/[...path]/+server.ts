/**
 * Kobo Catch-All Proxy
 *
 * ANY /api/kobo/[token]/[...path]
 *
 * Proxies unhandled Kobo API requests to the official Kobo store servers.
 * This allows users to still access Kobo store purchases while using BookShelf.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';

// Base URL for Kobo store API
const KOBO_API_BASE = 'https://storeapi.kobo.com';

// Analytics and other endpoints that should return empty success
const SILENT_ENDPOINTS = ['/v1/analytics/event', '/v1/analytics/gettests', '/v1/products/nextread'];

// Endpoints that should return empty objects/arrays
const EMPTY_RESPONSE_PATTERNS = [
	/\/v1\/products\/\d+\/nextread/,
	/\/v1\/library\/tags/,
	/\/v1\/user\/loyalty/,
	/\/v1\/user\/profile/,
	/\/v1\/user\/wishlist/,
	/\/v1\/user\/recommendations/
];

const handler: RequestHandler = async ({ params, request, fetch }) => {
	const { token, path } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	const requestPath = '/' + (path || '');

	// Check for silent endpoints (return empty success)
	for (const endpoint of SILENT_ENDPOINTS) {
		if (requestPath.includes(endpoint)) {
			return json({});
		}
	}

	// Check for empty response patterns
	for (const pattern of EMPTY_RESPONSE_PATTERNS) {
		if (pattern.test(requestPath)) {
			return json([]);
		}
	}

	// For v1/analytics/gettests, return a test response
	if (requestPath.includes('/v1/analytics/gettests')) {
		return json({
			Result: 'Success',
			TestKey: crypto.randomUUID().replace(/-/g, '').substring(0, 24)
		});
	}

	// Proxy to Kobo servers
	const koboUrl = `${KOBO_API_BASE}${requestPath}`;

	try {
		// Forward headers, filtering out host-specific ones
		const headers = new Headers();
		for (const [key, value] of request.headers.entries()) {
			const lowerKey = key.toLowerCase();
			if (
				!lowerKey.startsWith('host') &&
				!lowerKey.startsWith('origin') &&
				!lowerKey.startsWith('referer') &&
				lowerKey !== 'connection' &&
				lowerKey !== 'content-length'
			) {
				headers.set(key, value);
			}
		}

		// Add Kobo-specific headers if not present
		if (!headers.has('x-kobo-apitoken')) {
			headers.set('x-kobo-apitoken', 'e30=');
		}

		// Forward the request body for POST/PUT/PATCH
		let body: string | null = null;
		if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
			body = await request.text();
		}

		const response = await fetch(koboUrl, {
			method: request.method,
			headers,
			body
		});

		// Get response data
		const contentType = response.headers.get('content-type') || 'application/json';
		const responseData = await response.arrayBuffer();

		// Forward relevant response headers
		const responseHeaders = new Headers();
		responseHeaders.set('Content-Type', contentType);

		// Copy Kobo-specific headers
		for (const header of ['x-kobo-sync', 'x-kobo-synctoken', 'x-kobo-apitoken']) {
			const value = response.headers.get(header);
			if (value) {
				responseHeaders.set(header, value);
			}
		}

		return new Response(responseData, {
			status: response.status,
			headers: responseHeaders
		});
	} catch (err) {
		console.error('Kobo proxy error:', err);

		// Return empty response rather than error for most cases
		if (request.method === 'GET') {
			return json([]);
		}

		return json({});
	}
};

// Export all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
