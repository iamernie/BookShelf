import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRuleBasedRecommendations, getAISettings } from '$lib/server/services/recommendationService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const [ruleBasedRecommendations, aiSettings] = await Promise.all([
		getRuleBasedRecommendations(),
		getAISettings()
	]);

	return {
		ruleBasedRecommendations,
		aiEnabled: aiSettings.enabled && !!aiSettings.apiKey
	};
};
