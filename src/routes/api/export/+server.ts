/**
 * Export API
 * GET - Export library to CSV or JSON
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportLibrary, type ExportOptions } from '$lib/server/services/exportService';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const format = url.searchParams.get('format') as 'csv' | 'json' | null;
	if (!format || !['csv', 'json'].includes(format)) {
		throw error(400, 'Invalid format. Use ?format=csv or ?format=json');
	}

	const options: ExportOptions = {
		format,
		includeAuthors: url.searchParams.get('authors') !== 'false',
		includeSeries: url.searchParams.get('series') !== 'false',
		includeTags: url.searchParams.get('tags') !== 'false',
		includeGenres: url.searchParams.get('genres') !== 'false',
		includeFormats: url.searchParams.get('formats') !== 'false',
		includeNarrators: url.searchParams.get('narrators') !== 'false',
		includeStatuses: url.searchParams.get('statuses') !== 'false',
		goodreadsCompatible: url.searchParams.get('goodreads') === 'true'
	};

	try {
		const result = await exportLibrary(options);

		return new Response(result.data, {
			headers: {
				'Content-Type': result.mimeType,
				'Content-Disposition': `attachment; filename="${result.filename}"`,
				'X-Book-Count': result.bookCount.toString()
			}
		});
	} catch (e) {
		console.error('Export error:', e);
		throw error(500, 'Failed to export library');
	}
};
