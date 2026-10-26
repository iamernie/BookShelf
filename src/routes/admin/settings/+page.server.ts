import type { PageServerLoad } from './$types';
import { getAllSettings, getSetting, SECRET_SETTING_KEYS, SERVER_MANAGED_SETTING_KEYS, type SettingKey } from '$lib/server/services/settingsService';
import { getAISettings } from '$lib/server/services/recommendationService';
import { getEmailConfigStatus } from '$lib/server/services/emailService';
import { getStatuses } from '$lib/server/services/statusService';

export const load: PageServerLoad = async ({ locals }) => {
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
	const statuses = await getStatuses();

	// Audiobookshelf: only report whether a key is stored, never the key itself
	const absStatus = {
		apiKeySet: !!(await getSetting('integration.abs_api_key')).trim(),
		lastSync: (await getSetting('integration.abs_last_sync')) || null
	};

	return {
		settings: grouped,
		absStatus,
		aiSettings,
		emailStatus,
		statuses,
		isAdmin: locals.user?.role === 'admin'
	};
};
