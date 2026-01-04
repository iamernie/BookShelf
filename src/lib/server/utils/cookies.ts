/**
 * Cookie utilities for self-hosted deployments
 */

import { env } from '$env/dynamic/private';

/**
 * Determine if secure cookies should be used based on ORIGIN environment variable.
 * For self-hosted apps, only use secure cookies if ORIGIN starts with https://
 * This allows HTTP access on local networks while still being secure when HTTPS is configured.
 */
export function shouldUseSecureCookies(): boolean {
	return env.ORIGIN?.startsWith('https://') ?? false;
}

/**
 * Standard cookie options for session cookies
 */
export function getSessionCookieOptions(maxAge: number = 60 * 60 * 24 * 7) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: shouldUseSecureCookies(),
		maxAge
	};
}
