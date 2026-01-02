import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getSession, validateCredentials } from '$lib/server/services/authService';
import { createLogger, logRequest, logError } from '$lib/server/services/loggerService';
import { checkSetupNeeded } from '$lib/server/services/setupService';
import { migrationStatus } from '$lib/server/db';

const log = createLogger('hooks');

// Security headers to add to all responses
const securityHeaders: Record<string, string> = {
	'X-Frame-Options': 'SAMEORIGIN',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Add HSTS only in production (requires HTTPS)
if (!dev) {
	securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
}

const PUBLIC_PATHS = [
	'/login',
	'/reset-password',
	'/api/auth/login',
	'/api/auth/forgot-password',
	'/api/auth/reset-password',
	'/api/auth/oidc/providers',
	'/auth/oidc', // OIDC initiate and callback routes
	'/api/docs',
	'/docs',
	'/setup',
	'/api/setup',
	'/health',
	'/widgets',
	'/signup',
	'/api/auth/signup',
	'/upgrade',
	'/api/system/migration-status'
];

// Handle Basic Auth for OPDS routes
async function handleOPDSAuth(event: Parameters<Handle>[0]['event']): Promise<boolean> {
	const authHeader = event.request.headers.get('Authorization');

	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return false;
	}

	try {
		const base64Credentials = authHeader.slice(6);
		const credentials = atob(base64Credentials);
		const [email, password] = credentials.split(':');

		if (!email || !password) {
			return false;
		}

		const user = await validateCredentials(email, password);
		if (user) {
			event.locals.user = user;
			return true;
		}
	} catch {
		return false;
	}

	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Check if database migration is in progress
	const isUpgradePath = event.url.pathname.startsWith('/upgrade') ||
		event.url.pathname.startsWith('/api/system/migration-status');

	if (migrationStatus.inProgress && !isUpgradePath) {
		throw redirect(303, '/upgrade');
	}

	const isOPDSRoute = event.url.pathname.startsWith('/opds');

	// Handle OPDS routes with Basic Auth
	if (isOPDSRoute) {
		const isAuthenticated = await handleOPDSAuth(event);

		if (!isAuthenticated) {
			const authResponse = new Response('Unauthorized', {
				status: 401,
				headers: {
					'WWW-Authenticate': 'Basic realm="BookShelf OPDS"',
					'Content-Type': 'text/plain'
				}
			});
			// Add security headers to auth response
			for (const [header, value] of Object.entries(securityHeaders)) {
				authResponse.headers.set(header, value);
			}
			return authResponse;
		}

		const opdsResponse = await resolve(event);
		// Add security headers to OPDS response
		const opdsWithHeaders = new Response(opdsResponse.body, opdsResponse);
		for (const [header, value] of Object.entries(securityHeaders)) {
			opdsWithHeaders.headers.set(header, value);
		}
		return opdsWithHeaders;
	}

	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const session = await getSession(sessionId);
		if (session) {
			event.locals.user = session.user;
		} else {
			// Invalid/expired session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	// Check if route requires authentication
	const isPublicPath = PUBLIC_PATHS.some((path) => event.url.pathname.startsWith(path));
	const isSetupPath = event.url.pathname.startsWith('/setup') || event.url.pathname.startsWith('/api/setup');

	// Check if setup is needed (only for non-setup paths)
	if (!isSetupPath) {
		try {
			const setupStatus = await checkSetupNeeded();
			if (setupStatus.needsSetup) {
				throw redirect(303, '/setup');
			}
		} catch (e) {
			// If it's a redirect, rethrow it
			if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) {
				throw e;
			}
			// Otherwise log and continue (database might not be ready)
			log.warn('Setup check failed:', e as Record<string, unknown>);
		}
	}

	if (!event.locals.user && !isPublicPath) {
		throw redirect(303, '/login');
	}

	// Redirect logged-in users away from login page
	if (event.locals.user && event.url.pathname === '/login') {
		throw redirect(303, '/');
	}

	// Log request with timing
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	logRequest(event.request.method, event.url.pathname, response.status, duration);

	// Add security headers to response
	const responseWithHeaders = new Response(response.body, response);
	for (const [header, value] of Object.entries(securityHeaders)) {
		responseWithHeaders.headers.set(header, value);
	}

	return responseWithHeaders;
};

// Global error handler
export const handleError: HandleServerError = async ({ error: err, event, status, message }) => {
	const errorObj = err instanceof Error ? err : new Error(String(err));

	logError(errorObj, `${event.request.method} ${event.url.pathname}`);

	// Log additional details for debugging
	log.debug('Error details', {
		status,
		message,
		url: event.url.href,
		method: event.request.method,
		userAgent: event.request.headers.get('user-agent')
	});

	return {
		message: status === 500 ? 'Internal Server Error' : message
	};
};
