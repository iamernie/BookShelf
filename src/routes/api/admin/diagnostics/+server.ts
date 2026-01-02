import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runDiagnostics } from '$lib/server/services/diagnosticService';

export const GET: RequestHandler = async ({ locals }) => {
	// Admin-only access
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const health = await runDiagnostics();
		return json(health);
	} catch (err) {
		console.error('Error running diagnostics:', err);
		throw error(500, 'Failed to run diagnostics');
	}
};
