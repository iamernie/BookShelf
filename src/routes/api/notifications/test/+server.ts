import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendTestNotification, sendAdminTestNotification, isNtfyEnabled } from '$lib/server/services/notificationService';

/**
 * POST /api/notifications/test
 * Send a test notification to the current user or admin topic
 *
 * Body: { type: 'user' | 'admin' }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if ntfy is enabled system-wide
	const enabled = await isNtfyEnabled();
	if (!enabled) {
		return json({
			success: false,
			error: 'ntfy notifications are not enabled. Enable them in admin settings first.'
		}, { status: 400 });
	}

	try {
		const body = await request.json();
		const type = body?.type || 'user';

		if (type === 'admin') {
			// Only admins can test admin notifications
			if (locals.user.role !== 'admin') {
				return json({ error: 'Admin access required' }, { status: 403 });
			}

			const result = await sendAdminTestNotification();
			return json(result);
		} else {
			// Test user's personal notification
			const result = await sendTestNotification(locals.user.id);
			return json(result);
		}
	} catch (err) {
		console.error('[notifications/test] Error:', err);
		return json({
			success: false,
			error: err instanceof Error ? err.message : 'Failed to send test notification'
		}, { status: 500 });
	}
};
