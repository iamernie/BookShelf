/**
 * App-timezone calendar helpers (server-only: reads APP_TIMEZONE from env)
 *
 * The container runs in UTC, so "today" taken from toISOString() or process-local
 * Date getters rolls over at 7-8 pm in Toronto. Everything that needs a calendar
 * day - auto-stamped reading dates, day bucketing, year/month roll-overs - goes
 * through these helpers instead, using an explicit Intl timeZone.
 *
 * Never import this from $lib/utils/ or any client code.
 */

import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('appTime');

const DEFAULT_TIMEZONE = 'America/Toronto';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function resolveTimeZone(): string {
	const configured = process.env.APP_TIMEZONE?.trim();
	if (!configured) return DEFAULT_TIMEZONE;
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone: configured });
		return configured;
	} catch {
		log.warn('Invalid APP_TIMEZONE, falling back to default', { configured, fallback: DEFAULT_TIMEZONE });
		return DEFAULT_TIMEZONE;
	}
}

export const APP_TIMEZONE = resolveTimeZone();

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
	timeZone: APP_TIMEZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});

function zonedParts(ms: number): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
	const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
	for (const part of partsFormatter.formatToParts(ms)) {
		if (part.type in out) out[part.type as keyof typeof out] = Number(part.value);
	}
	return out;
}

function pad(n: number, width = 2): string {
	return String(n).padStart(width, '0');
}

// Zone offset (local wall clock minus UTC) in ms at the given instant
function offsetAt(ms: number): number {
	const p = zonedParts(ms);
	const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return wall - Math.floor(ms / 1000) * 1000;
}

/** App-timezone calendar date (zero-padded YYYY-MM-DD) of an instant */
export function dateInAppTz(instant: Date | number | string): string {
	const ms = instant instanceof Date ? instant.getTime() : typeof instant === 'number' ? instant : Date.parse(instant);
	const p = zonedParts(ms);
	return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today in the app timezone, zero-padded YYYY-MM-DD */
export function todayInAppTz(): string {
	return dateInAppTz(Date.now());
}

/** Current year in the app timezone */
export function currentYearInAppTz(): number {
	return Number(todayInAppTz().slice(0, 4));
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no instants, so DST-safe) */
export function addDays(dateOnly: string, n: number): string {
	const [y, m, d] = dateOnly.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** True when the value is a zero-padded YYYY-MM-DD string */
export function isDateOnlyString(value: string): boolean {
	return DATE_ONLY.test(value);
}

/**
 * UTC ISO instant of local midnight in the app timezone for a YYYY-MM-DD,
 * for querying UTC timestamp columns by local day. The offset is read at the
 * target instant, so DST is handled for any configured zone.
 */
export function startOfDayInAppTz(dateOnly: string): string {
	const [y, m, d] = dateOnly.split('-').map(Number);
	const wallMidnight = Date.UTC(y, m - 1, d);
	const before = wallMidnight - offsetAt(wallMidnight - 86400000);
	const after = wallMidnight - offsetAt(wallMidnight + 86400000);
	// A candidate is real when the zone's offset at that instant is the one it was built from
	const valid = [before, after].filter((c) => wallMidnight - offsetAt(c) === c).sort((a, b) => a - b);
	// No valid candidate means midnight was skipped by DST: the day starts at the transition
	return new Date(valid[0] ?? before).toISOString();
}
