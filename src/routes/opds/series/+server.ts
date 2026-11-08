import type { RequestHandler } from './$types';
import { generateSeriesFeed, getOPDSConfig } from '$lib/server/services/opdsService';

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=navigation';

export const GET: RequestHandler = async ({ url, locals }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const config = getOPDSConfig(baseUrl);

	const xml = await generateSeriesFeed(config, locals.user);

	return new Response(xml, {
		headers: {
			'Content-Type': OPDS_MIME,
			'Cache-Control': 'private, max-age=0'
		}
	});
};
