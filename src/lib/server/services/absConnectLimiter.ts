import { checkRateLimit, type RateLimitResult } from '$lib/server/middleware/rateLimiter';

/**
 * Connect attempts (self-connect and admin Assign), keyed by the ACTING user, never by IP: a
 * household behind one NAT must not burn its shared sign-in budget by testing keys (S9).
 * 10 attempts per 15 minutes, then 15 minutes blocked.
 */
export function checkAbsConnectLimit(actorUserId: number): RateLimitResult {
	return checkRateLimit(`abs-connect:user:${actorUserId}`, {
		windowMs: 15 * 60 * 1000,
		maxRequests: 10,
		blockDurationMs: 15 * 60 * 1000
	});
}
