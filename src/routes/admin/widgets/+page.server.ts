import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getWidgetToken,
	areWidgetsEnabled,
	setWidgetsEnabled,
	regenerateWidgetToken
} from '$lib/server/services/widgetService';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const token = await getWidgetToken();
	const enabled = await areWidgetsEnabled();
	const baseUrl = `${url.protocol}//${url.host}`;

	return {
		token,
		enabled,
		baseUrl
	};
};

export const actions: Actions = {
	toggleEnabled: async ({ locals, request }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const data = await request.formData();
		const enabled = data.get('enabled') === 'true';

		await setWidgetsEnabled(enabled);

		return { success: true, enabled };
	},

	regenerateToken: async ({ locals }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const newToken = await regenerateWidgetToken();

		return { success: true, token: newToken };
	}
};
