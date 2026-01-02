import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStatuses } from '$lib/server/services/statusService';

export const GET: RequestHandler = async () => {
	const items = await getStatuses();
	return json({ items, total: items.length });
};

// Note: No POST - statuses are system-defined and cannot be created
