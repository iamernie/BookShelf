import type { RequestHandler } from './$types';
import { generateAuthorsFeed, getOPDSConfig } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=navigation';

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);

	const xml = await generateAuthorsFeed(config);

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'public, max-age=300'
		}
	});
};
