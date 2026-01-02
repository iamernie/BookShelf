import type { RequestHandler } from './$types';
import { getOPDSConfig, generateSeriesBooksFeed } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=acquisition';

export const GET: RequestHandler = async ({ url, params }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);
	const seriesId = parseInt(params.id, 10);

	if (isNaN(seriesId)) {
		return new Response('Invalid series ID', { status: 400 });
	}

	const xml = await generateSeriesBooksFeed(config, seriesId);

	if (!xml) {
		return new Response('Series not found', { status: 404 });
	}

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'public, max-age=300'
		}
	});
};
