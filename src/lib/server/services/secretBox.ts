import crypto from 'crypto';
import { env } from '$env/dynamic/private';

/**
 * Reversible encryption for secrets BookShelf must send back out (2.36.0: members' Audiobookshelf
 * API keys, which ABS needs in clear, so they cannot be hashed).
 *
 * AES-256-GCM with a key derived by HKDF-SHA256 from SESSION_SECRET. Sealed form:
 *   v1.<iv base64url>.<tag base64url>.<ciphertext base64url>
 *
 * Fails closed: when SESSION_SECRET is unset, shorter than 32 characters or a value shipped in the
 * repo's examples, nothing is sealed or opened (a "secret" everyone knows would encrypt full-access
 * keys under a public key). Callers turn SecretBoxUnavailable into 503 (connect) or decrypt_failed
 * (sync). Changing SESSION_SECRET makes every sealed value unreadable: members reconnect.
 */

const VERSION = 'v1';
const HKDF_SALT = 'bookshelf-secret-box';
const HKDF_INFO = 'bookshelf-abs-user-key-v1';
export const MIN_SECRET_LENGTH = 32;

// Values that appear in .env.example, docker-compose.test.yml, DEVELOPMENT.md and common docs
const PLACEHOLDER_SECRETS = [
	'your-secret-key-here',
	'your-secret-here',
	'test-secret-please-change-in-production',
	'change-me',
	'changeme',
	'secret',
	'session-secret'
];

export type SecretBoxRefusal = 'unset' | 'short' | 'placeholder';

export class SecretBoxUnavailable extends Error {
	constructor(readonly reason: SecretBoxRefusal) {
		super(`Secret storage unavailable: SESSION_SECRET is ${reason === 'unset' ? 'not set' : reason === 'short' ? `shorter than ${MIN_SECRET_LENGTH} characters` : 'a known placeholder'}`);
		this.name = 'SecretBoxUnavailable';
	}
}

function isPlaceholder(secret: string): boolean {
	const s = secret.trim().toLowerCase();
	return PLACEHOLDER_SECRETS.includes(s) || s.startsWith('test-secret-please-change') || s.startsWith('your-secret');
}

/** Why the box refuses, or null when SESSION_SECRET is usable. */
export function secretBoxRefusal(): SecretBoxRefusal | null {
	const secret = env.SESSION_SECRET ?? '';
	if (!secret.trim()) return 'unset';
	if (isPlaceholder(secret)) return 'placeholder';
	if (secret.length < MIN_SECRET_LENGTH) return 'short';
	return null;
}

function key(): Buffer {
	const refusal = secretBoxRefusal();
	if (refusal) throw new SecretBoxUnavailable(refusal);
	return Buffer.from(crypto.hkdfSync('sha256', env.SESSION_SECRET as string, HKDF_SALT, HKDF_INFO, 32));
}

export function sealSecret(plain: string): string {
	const k = key();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
	const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** Throws SecretBoxUnavailable when the box refuses, or a plain Error when the value doesn't open. */
export function openSecret(sealed: string): string {
	const k = key();
	const [version, iv, tag, ct] = sealed.split('.');
	if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error('Unrecognized sealed value');
	const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Non-reversible short id for a key: display ("key abcd1234") and rotation audit. */
export function secretFingerprint(plain: string): string {
	return crypto.createHash('sha256').update(plain, 'utf8').digest('hex').slice(0, 16);
}
