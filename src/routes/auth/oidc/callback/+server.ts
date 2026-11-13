import type { RequestHandler } from './$types';
import { runOidcCallback } from '$lib/server/services/oidcCallbackService';
import { env } from '$env/dynamic/private';

// The callback flow lives in oidcCallbackService (group gate, linking check, approval, auto-create)
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	return runOidcCallback({ url, cookies, locals, baseUrl: env.PUBLIC_BASE_URL || url.origin });
};
