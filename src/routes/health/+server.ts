import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { APP_CONFIG } from '$lib/config/app';

export const GET: RequestHandler = async () => {
	try {
		// Check database connectivity
		const result = db.get<{ ok: number }>(sql`SELECT 1 as ok`);

		if (!result || result.ok !== 1) {
			return json({ status: 'error', message: 'Database check failed' }, { status: 503 });
		}

		return json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			version: APP_CONFIG.version
		});
	} catch (error) {
		return json(
			{ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 503 }
		);
	}
};
