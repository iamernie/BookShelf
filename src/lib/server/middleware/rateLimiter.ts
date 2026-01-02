/**
 * Simple in-memory rate limiter for auth endpoints
 * Tracks requests by IP address and applies limits per endpoint
 */

interface RateLimitEntry {
	count: number;
	firstRequest: number;
	blockedUntil?: number;
}

// Store rate limit entries by key (usually IP + endpoint)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries(windowMs: number) {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;

	lastCleanup = now;
	const cutoff = now - windowMs * 2; // Keep entries for 2x the window

	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.firstRequest < cutoff && (!entry.blockedUntil || entry.blockedUntil < now)) {
			rateLimitStore.delete(key);
		}
	}
}

export interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Max requests per window
	blockDurationMs?: number; // How long to block after limit exceeded (default: same as window)
	keyGenerator?: (request: Request) => string; // Custom key generator
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	retryAfter?: number; // Seconds until retry allowed
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
	// Check common proxy headers
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		// Take the first IP in the chain (original client)
		return forwardedFor.split(',')[0].trim();
	}

	const realIP = request.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}

	// Fallback - in production behind a proxy this shouldn't happen
	return 'unknown';
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
	key: string,
	config: RateLimitConfig
): RateLimitResult {
	const now = Date.now();
	const { windowMs, maxRequests, blockDurationMs = windowMs } = config;

	// Cleanup periodically
	cleanupOldEntries(windowMs);

	let entry = rateLimitStore.get(key);

	// Check if currently blocked
	if (entry?.blockedUntil && entry.blockedUntil > now) {
		const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
		return {
			allowed: false,
			remaining: 0,
			resetAt: entry.blockedUntil,
			retryAfter
		};
	}

	// Reset if window has passed
	if (!entry || now - entry.firstRequest > windowMs) {
		entry = {
			count: 0,
			firstRequest: now
		};
	}

	// Increment count
	entry.count++;
	rateLimitStore.set(key, entry);

	// Check if limit exceeded
	if (entry.count > maxRequests) {
		entry.blockedUntil = now + blockDurationMs;
		rateLimitStore.set(key, entry);

		return {
			allowed: false,
			remaining: 0,
			resetAt: entry.blockedUntil,
			retryAfter: Math.ceil(blockDurationMs / 1000)
		};
	}

	return {
		allowed: true,
		remaining: maxRequests - entry.count,
		resetAt: entry.firstRequest + windowMs
	};
}

/**
 * Create a rate limiter for a specific endpoint
 */
export function createRateLimiter(config: RateLimitConfig) {
	return {
		check: (request: Request, additionalKey?: string): RateLimitResult => {
			const ip = config.keyGenerator
				? config.keyGenerator(request)
				: getClientIP(request);
			const key = additionalKey ? `${ip}:${additionalKey}` : ip;
			return checkRateLimit(key, config);
		}
	};
}

// Pre-configured rate limiters for common use cases

/**
 * Rate limiter for password reset requests
 * 3 requests per hour per IP
 */
export const passwordResetLimiter = createRateLimiter({
	windowMs: 60 * 60 * 1000, // 1 hour
	maxRequests: 3,
	blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
});

/**
 * Rate limiter for login attempts
 * 10 attempts per 15 minutes per IP
 */
export const loginLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: 10,
	blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes
});

/**
 * Rate limiter for signup attempts
 * 5 signups per hour per IP
 */
export const signupLimiter = createRateLimiter({
	windowMs: 60 * 60 * 1000, // 1 hour
	maxRequests: 5,
	blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
});

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const apiLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 100,
	blockDurationMs: 60 * 1000 // Block for 1 minute
});
