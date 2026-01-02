import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAvailablePlaceholders } from '$lib/server/services/settingsService';
import { previewPatternWithExample } from '$lib/server/services/fileNamingService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const placeholders = getAvailablePlaceholders();

	return json({ placeholders });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { pattern } = await request.json();

		if (typeof pattern !== 'string') {
			return json({ error: 'Pattern must be a string' }, { status: 400 });
		}

		const preview = previewPatternWithExample(pattern);

		return json({ preview, pattern });
	} catch (error) {
		console.error('Pattern preview error:', error);
		return json({ error: 'Failed to preview pattern' }, { status: 500 });
	}
};
