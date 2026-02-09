/**
 * API v1 Tags Endpoint
 * Returns all tags
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { db, tags, bookTags } from '$lib/server/db';
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
		const tagList = await db.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			icon: tags.icon,
			bookCount: sql<number>`(SELECT COUNT(*) FROM ${bookTags} WHERE ${bookTags.tagId} = ${tags.id})`
		})
			.from(tags)
			.orderBy(desc(sql`bookCount`));

		return json({ tags: tagList });
	} catch (err) {
		console.error('API v1 tags error:', err);
		return json({ error: 'Failed to fetch tags' }, { status: 500 });
	}
};
