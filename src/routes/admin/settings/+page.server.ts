import type { PageServerLoad } from './$types';
import { getAllSettings } from '$lib/server/services/settingsService';
import { getAISettings } from '$lib/server/services/recommendationService';
import { getEmailConfigStatus } from '$lib/server/services/emailService';
import { getStatuses } from '$lib/server/services/statusService';

export const load: PageServerLoad = async ({ locals }) => {
	const settings = await getAllSettings();

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

	return {
		settings: grouped,
		aiSettings,
		emailStatus,
		statuses,
		isAdmin: locals.user?.role === 'admin'
	};
};
