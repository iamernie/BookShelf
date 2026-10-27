/**
 * Reading Sessions API
 *
 * GET - Get heatmap data for a year
 * POST - Start a new reading session
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { HeatmapSource } from '$lib/server/services/readingSessionService';
import { currentYearInAppTz } from '$lib/server/utils/appTime';
import {
	startSession,
	getHeatmapDataForSource,
	getRecentSessions,
	getReadingStats
} from '$lib/server/services/readingSessionService';

const HEATMAP_SOURCES: Array<HeatmapSource | 'auto'> = ['all', 'books', 'listening', 'auto'];

export const GET: RequestHandler = async ({ url }) => {
	const year = parseInt(url.searchParams.get('year') || currentYearInAppTz().toString());
	const type = url.searchParams.get('type') || 'heatmap';

	if (type === 'heatmap') {
		const source = url.searchParams.get('source') || 'auto';
		if (!HEATMAP_SOURCES.includes(source as HeatmapSource | 'auto')) {
			throw error(400, 'Invalid source parameter');
		}
		const data = await getHeatmapDataForSource(year, source as HeatmapSource | 'auto');
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
