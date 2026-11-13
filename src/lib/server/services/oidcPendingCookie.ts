import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, settings } from '$lib/server/db';
import { DEFAULT_SETTINGS } from './settingsService';

/**
 * The oidc_pending cookie carries a provider identity from the callback to the complete page.
 * Since 2.34.0 it is signed: v1.<expMs>.<base64url(json)>.<base64url(HMAC-SHA256)>, keyed by a
 * server-held random key (settings row auth.oidc_pending_signing_key, created on first use, never
 * at boot). A cookie that fails any check reads as null, which the complete page treats exactly
 * like the old unparseable-cookie case (invalid_session).
 */

export const OIDC_PENDING_COOKIE = 'oidc_pending';
export const OIDC_PENDING_TTL_MS = 15 * 60 * 1000;

const KEY_SETTING = 'auth.oidc_pending_signing_key' as const;
const CONTEXT = 'bookshelf-oidc-pending-v1';

function readKey(): string {
	const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY_SETTING)).get();
	return row?.value ?? '';
}

/** The signing key, created in one synchronous transaction the first time it is needed */
function ensureKey(): string {
	return db.transaction((tx) => {
		const row = tx.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY_SETTING)).get();
		if (row?.value) return row.value;
		const key = crypto.randomBytes(32).toString('base64url');
		const meta = DEFAULT_SETTINGS[KEY_SETTING];
		const now = new Date().toISOString();
		tx.insert(settings)
			.values({ key: KEY_SETTING, value: key, type: meta.type, category: meta.category, label: meta.label, description: meta.description, isSystem: true, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({ target: settings.key, set: { value: key, updatedAt: now } })
			.run();
		return key;
	});
}

function mac(key: string, exp: string, body: string): string {
	return crypto.createHmac('sha256', key).update(`${CONTEXT}|${exp}|${body}`).digest('base64url');
}

const digest = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest();

/** Sign the pending JSON for the cookie */
export function signPendingCookie(json: string, now: number = Date.now()): string {
	const key = ensureKey();
	const exp = String(now + OIDC_PENDING_TTL_MS);
	const body = Buffer.from(json, 'utf8').toString('base64url');
	return `v1.${exp}.${body}.${mac(key, exp, body)}`;
}

/** The JSON text of a cookie this server signed and that has not expired, else null */
export function openPendingCookie(raw: string | undefined | null, now: number = Date.now()): string | null {
	try {
		if (!raw) return null;
		const parts = raw.split('.');
		if (parts.length !== 4 || parts[0] !== 'v1') return null;
		const [, exp, body, sig] = parts;
		if (!/^\d{1,16}$/.test(exp) || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
		const expMs = Number(exp);
		if (!(now < expMs && expMs <= now + OIDC_PENDING_TTL_MS)) return null;
		const key = readKey();
		if (!key) return null;
		if (!crypto.timingSafeEqual(digest(sig), digest(mac(key, exp, body)))) return null;
		return Buffer.from(body, 'base64url').toString('utf8');
	} catch {
		return null;
	}
}

/** Parsed pending data from a valid signed cookie, else null */
export function readPendingCookie<T>(raw: string | undefined | null, now: number = Date.now()): T | null {
	const json = openPendingCookie(raw, now);
	if (json === null) return null;
	try {
		const data = JSON.parse(json) as T;
		return data && typeof data === 'object' ? data : null;
	} catch {
		return null;
	}
}
