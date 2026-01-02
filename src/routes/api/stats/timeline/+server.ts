import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReadingTimeline } from '$lib/server/services/statsService';

export const GET: RequestHandler = async ({ url }) => {
	const yearParam = url.searchParams.get('year');
	const year = yearParam ? parseInt(yearParam, 10) : undefined;

	const timeline = await getReadingTimeline(year);
	return json(timeline);
};
