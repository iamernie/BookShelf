/**
 * API v1 Statuses Endpoint
 * Returns all statuses
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, statuses } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	try {
		const statusList = await db.select({
			id: statuses.id,
			name: statuses.name,
			key: statuses.key,
			color: statuses.color,
			icon: statuses.icon,
			sortOrder: statuses.sortOrder,
			isSystem: statuses.isSystem
		})
			.from(statuses)
			.orderBy(asc(statuses.sortOrder));

		return json({ statuses: statusList });
	} catch (err) {
		console.error('API v1 statuses error:', err);
		return json({ error: 'Failed to fetch statuses' }, { status: 500 });
	}
};
