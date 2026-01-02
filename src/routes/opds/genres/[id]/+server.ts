import type { RequestHandler } from './$types';
import { getOPDSConfig, generateGenreBooksFeed } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';

export const GET: RequestHandler = async ({ url, params }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);
	const genreId = parseInt(params.id, 10);

	if (isNaN(genreId)) {
		return new Response('Invalid genre ID', { status: 400 });
	}

	const xml = await generateGenreBooksFeed(config, genreId);

	if (!xml) {
		return new Response('Genre not found', { status: 404 });
	}

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'public, max-age=300'
		}
	});
};
