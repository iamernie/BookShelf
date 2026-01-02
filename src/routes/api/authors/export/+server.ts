import type { RequestHandler } from './$types';
import { exportAuthorsToCSV } from '$lib/server/services/authorService';

/**
 * GET /api/authors/export
 * Export authors to CSV
 */
export const GET: RequestHandler = async () => {
	try {
		const csv = await exportAuthorsToCSV();

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename=authors_export_${Date.now()}.csv`
			}
		});
	} catch (error) {
		console.error('Error exporting authors:', error);
		return new Response('Error exporting authors', { status: 500 });
	}
};
