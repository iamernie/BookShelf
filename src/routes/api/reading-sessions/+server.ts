/**
 * Reading Sessions API
 *
 * GET - Get heatmap data for a year
 * POST - Start a new reading session
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	startSession,
	getHeatmapData,
	getRecentSessions,
	getReadingStats
} from '$lib/server/services/readingSessionService';

export const GET: RequestHandler = async ({ url }) => {
	const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());
	const type = url.searchParams.get('type') || 'heatmap';

	if (type === 'heatmap') {
		const data = await getHeatmapData(year);
		return json(data);
	}

	if (type === 'recent') {
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const sessions = await getRecentSessions(limit);
		return json(sessions);
	}

	if (type === 'stats') {
		const startDate = url.searchParams.get('startDate') || `${year}-01-01`;
		const endDate = url.searchParams.get('endDate') || `${year}-12-31`;
		const stats = await getReadingStats(startDate, endDate);
		return json(stats);
	}

	throw error(400, 'Invalid type parameter');
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { bookId, startProgress } = body;

	if (!bookId) {
		throw error(400, 'bookId is required');
	}

	const sessionId = await startSession(bookId, undefined, startProgress);

	return json({ sessionId });
};
