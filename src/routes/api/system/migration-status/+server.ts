import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { migrationStatus } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	return json(migrationStatus);
};
