/**
 * API v1 Formats Endpoint
 * Returns all formats
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, formats, books } from '$lib/server/db';
import { sql, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!(await areWidgetsEnabled())) {
		return json({ error: 'API is disabled' }, { status: 403 });
	}

	if (!token || !(await validateWidgetToken(token))) {
		return json({ error: 'Invalid or missing API token' }, { status: 401 });
	}

	try {
		const formatList = await db.select({
			id: formats.id,
			name: formats.name,
			color: formats.color,
			icon: formats.icon,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${books} WHERE ${books.formatId} = ${formats.id})`
		})
			.from(formats)
			.orderBy(desc(sql`bookCount`));

		return json({ formats: formatList });
	} catch (err) {
		console.error('API v1 formats error:', err);
		return json({ error: 'Failed to fetch formats' }, { status: 500 });
	}
};
