import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAllSettings, getSetting, SECRET_SETTING_KEYS, SERVER_MANAGED_SETTING_KEYS, type SettingKey } from '$lib/server/services/settingsService';
import { getAISettings } from '$lib/server/services/recommendationService';
import { getEmailConfigStatus } from '$lib/server/services/emailService';
import { getStatuses } from '$lib/server/services/statusService';
import { getSyncOverview } from '$lib/server/services/absSyncService';
import { getRefreshOverview } from '$lib/server/services/audibleSuggestService';
import { db, users } from '$lib/server/db';
import { asc, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	// Admin only, like the OIDC page
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	if (locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	// Secrets and server-managed values never enter the editable form
	const hidden = new Set<string>([...SECRET_SETTING_KEYS, ...SERVER_MANAGED_SETTING_KEYS]);
	const settings = (await getAllSettings()).filter((s) => !hidden.has(s.key as SettingKey));

	// Group settings by category
	const grouped: Record<string, typeof settings> = {};
	for (const setting of settings) {
		if (!grouped[setting.category]) {
			grouped[setting.category] = [];
		}
		grouped[setting.category].push(setting);
	}

	// Get AI settings separately (they use a different storage pattern)
	const aiSettings = await getAISettings();

	// Get email configuration status
	const emailStatus = await getEmailConfigStatus();

	// Get statuses for default status dropdown
	const statuses = await getStatuses(locals.user?.id);

	// Audiobookshelf: only report whether a key is stored, never the key itself
	const absStatus = {
		apiKeySet: !!(await getSetting('integration.abs_api_key')).trim(),
		sync: await getSyncOverview(),
		// Sync owner choices: books the sync creates belong to an admin or librarian
		ownerChoices: await db.select({ id: users.id, username: users.username, role: users.role })
			.from(users)
			.where(inArray(users.role, ['admin', 'librarian']))
			.orderBy(asc(users.username))
	};

	return {
		settings: grouped,
		absStatus,
		audibleSuggest: await getRefreshOverview(),
		aiSettings,
		emailStatus,
		statuses,
		localLoginDisabled: (await getSetting('auth.disable_local_login')) === 'true',
		isAdmin: locals.user?.role === 'admin'
	};
};
