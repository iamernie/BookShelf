import type { RequestHandler } from './$types';
import { getOPDSConfig, generateAuthorBooksFeed } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';

export const GET: RequestHandler = async ({ url, params }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);
	const authorId = parseInt(params.id, 10);

	if (isNaN(authorId)) {
		return new Response('Invalid author ID', { status: 400 });
	}

	const xml = await generateAuthorBooksFeed(config, authorId);

	if (!xml) {
		return new Response('Author not found', { status: 404 });
	}

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'public, max-age=300'
		}
	});
};
