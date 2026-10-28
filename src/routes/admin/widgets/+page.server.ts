import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getWidgetToken,
	areWidgetsEnabled,
	setWidgetsEnabled,
	isApiEnabled,
	setApiEnabled,
	regenerateWidgetToken,
	listAllWidgetsForAdmin,
	setWidgetDisabled
} from '$lib/server/services/widgetService';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const token = await getWidgetToken();
	const enabled = await areWidgetsEnabled();
	const apiEnabled = await isApiEnabled();
	const widgets = await listAllWidgetsForAdmin();

	return {
		token,
		enabled,
		apiEnabled,
		widgets
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

	toggleApiEnabled: async ({ locals, request }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const data = await request.formData();
		const apiEnabled = data.get('enabled') === 'true';

		await setApiEnabled(apiEnabled);

		return { success: true, apiEnabled };
	},

	regenerateToken: async ({ locals }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const newToken = await regenerateWidgetToken();

		return { success: true, token: newToken };
	},

	disableWidget: async ({ locals, request }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const id = parseInt(String((await request.formData()).get('id') ?? ''), 10);
		if (isNaN(id)) {
			return fail(400, { message: 'Invalid widget ID' });
		}
		if (!(await setWidgetDisabled(id, locals.user.id, true))) {
			return fail(404, { message: 'Widget not found' });
		}

		return { success: true, id, disabled: true };
	},

	enableWidget: async ({ locals, request }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, 'Admin access required');
		}

		const id = parseInt(String((await request.formData()).get('id') ?? ''), 10);
		if (isNaN(id)) {
			return fail(400, { message: 'Invalid widget ID' });
		}
		if (!(await setWidgetDisabled(id, locals.user.id, false))) {
			return fail(404, { message: 'Widget not found' });
		}

		return { success: true, id, disabled: false };
	}
};
