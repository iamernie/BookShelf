import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { areWidgetsEnabled, listWidgets, MAX_WIDGETS_PER_USER } from '$lib/server/services/widgetService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const [widgets, widgetsEnabled] = await Promise.all([listWidgets(locals.user.id), areWidgetsEnabled()]);

	return {
		widgets,
		widgetsEnabled,
		canCreate: locals.user.role !== 'guest',
		maxWidgets: MAX_WIDGETS_PER_USER
	};
};
