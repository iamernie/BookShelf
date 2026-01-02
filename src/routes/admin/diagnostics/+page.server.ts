import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { runDiagnostics } from '$lib/server/services/diagnosticService';

export const load: PageServerLoad = async ({ locals }) => {
	// Require admin access
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(303, '/');
	}

	const health = await runDiagnostics();

	return {
		health
	};
};
