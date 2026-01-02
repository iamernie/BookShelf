import type { RequestHandler } from './$types';
import { generateSearchFeed, getOPDSConfig } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);

	const query = url.searchParams.get('q') || '';

	const xml = await generateSearchFeed(config, query);

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'private, max-age=0'
		}
	});
};
