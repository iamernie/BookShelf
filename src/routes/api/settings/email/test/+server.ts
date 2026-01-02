/**
 * Test Email API
 * POST /api/settings/email/test
 *
 * Sends a test email to verify SMTP configuration
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendTestEmail, clearEmailCache } from '$lib/server/services/emailService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();
	const { email } = body as { email?: string };

	if (!email) {
		throw error(400, 'Email address is required');
	}

	// Clear the cache to pick up any recent settings changes
	clearEmailCache();

	const result = await sendTestEmail(email);

	return json(result);
};
