import type { RequestHandler } from './$types';
import { generateBooksFeed, getOPDSConfig } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);

	const page = parseInt(url.searchParams.get('page') || '1');

	const xml = await generateBooksFeed(config, { page, orderBy: 'recent' });

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'public, max-age=60'
		}
	});
};
