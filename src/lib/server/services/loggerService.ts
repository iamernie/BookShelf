import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Log levels following standard conventions
const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4
};

// Log entry type for in-memory buffer
export interface LogEntry {
	id: string;
	timestamp: string;
	level: string;
	message: string;
	context?: string;
	meta?: Record<string, unknown>;
}

// In-memory log buffer for console page
const MAX_LOG_ENTRIES = 500;
const logBuffer: LogEntry[] = [];
let logIdCounter = 0;

// Custom transport to capture logs in memory
class MemoryTransport extends winston.transports.Stream {
	constructor() {
		super({ stream: process.stdout }); // Dummy stream, we override log()
	}

	log(info: winston.Logform.TransformableInfo, callback: () => void) {
		const entry: LogEntry = {
			id: `log_${++logIdCounter}_${Date.now()}`,
			timestamp: (info.timestamp as string) || new Date().toISOString(),
			level: info.level as string,
			message: info.message as string,
			context: info.context as string | undefined,
			meta: { ...info }
		};

		// Remove standard fields from meta
		delete entry.meta!.timestamp;
		delete entry.meta!.level;
		delete entry.meta!.message;
		delete entry.meta!.context;

		// Add to buffer, remove oldest if over limit
		logBuffer.push(entry);
		if (logBuffer.length > MAX_LOG_ENTRIES) {
			logBuffer.shift();
		}

		callback();
	}
}

// Get logs from buffer with optional filtering
export function getLogs(options?: {
	level?: string;
	context?: string;
	limit?: number;
	since?: string;
}): LogEntry[] {
	let logs = [...logBuffer];

	if (options?.level) {
		const targetLevel = levels[options.level as keyof typeof levels];
		logs = logs.filter(log => {
			const logLevel = levels[log.level as keyof typeof levels];
			return logLevel !== undefined && logLevel <= targetLevel;
		});
	}

	if (options?.context) {
		logs = logs.filter(log => log.context === options.context);
	}

	if (options?.since) {
		const sinceDate = new Date(options.since);
		logs = logs.filter(log => new Date(log.timestamp) >= sinceDate);
	}

	// Return newest first
	logs.reverse();

	if (options?.limit) {
		logs = logs.slice(0, options.limit);
	}

	return logs;
}

// Clear log buffer
export function clearLogs(): void {
	logBuffer.length = 0;
}

// Get log statistics
export function getLogStats(): { total: number; byLevel: Record<string, number> } {
	const byLevel: Record<string, number> = {};
	for (const log of logBuffer) {
		byLevel[log.level] = (byLevel[log.level] || 0) + 1;
	}
	return { total: logBuffer.length, byLevel };
}

// Colors for console output
const colors = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	http: 'magenta',
	debug: 'white'
};

winston.addColors(colors);

// Format for console output (colorized, human-readable)
const consoleFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.colorize({ all: true }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
		return `${timestamp} [${level}]: ${message}${metaStr}`;
	})
);

// Format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	winston.format.json()
);

// Determine log level from environment
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Log directory (can be configured via environment)
const logDir = process.env.LOG_DIR || './logs';

// Ensure log directory exists in production
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
	try {
		if (!existsSync(logDir)) {
			mkdirSync(logDir, { recursive: true });
		}
	} catch (e) {
		console.error('Failed to create log directory:', logDir, e);
	}
}

// Format for memory transport (includes timestamp)
const memoryFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true })
);

// Create transports array
const transports: winston.transport[] = [
	// Always log to console
	new winston.transports.Console({
		format: consoleFormat
	}),
	// Always log to memory for console page
	Object.assign(new MemoryTransport(), { format: memoryFormat })
];

// In production or when LOG_TO_FILE is set, also log to files
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
	// Daily rotate file for all logs
	transports.push(
		new DailyRotateFile({
			filename: path.join(logDir, 'app-%DATE%.log'),
			datePattern: 'YYYY-MM-DD',
			maxSize: '20m',
			maxFiles: '14d',
			format: fileFormat
		})
	);

	// Separate file for errors only
	transports.push(
		new DailyRotateFile({
			filename: path.join(logDir, 'error-%DATE%.log'),
			datePattern: 'YYYY-MM-DD',
			maxSize: '20m',
			maxFiles: '30d',
			level: 'error',
			format: fileFormat
		})
	);
}

// Create the logger
const logger = winston.createLogger({
	level,
	levels,
	transports,
	// Don't exit on handled exceptions
	exitOnError: false
});

// Convenience methods with context
export const log = {
	error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
	warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
	info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
	http: (message: string, meta?: Record<string, unknown>) => logger.http(message, meta),
	debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta)
};

// Create a child logger for a specific module/context
export function createLogger(context: string) {
	return {
		error: (message: string, meta?: Record<string, unknown>) =>
			logger.error(message, { context, ...meta }),
		warn: (message: string, meta?: Record<string, unknown>) =>
			logger.warn(message, { context, ...meta }),
		info: (message: string, meta?: Record<string, unknown>) =>
			logger.info(message, { context, ...meta }),
		http: (message: string, meta?: Record<string, unknown>) =>
			logger.http(message, { context, ...meta }),
		debug: (message: string, meta?: Record<string, unknown>) =>
			logger.debug(message, { context, ...meta })
	};
}

// HTTP request logging middleware-style function
export function logRequest(method: string, url: string, status: number, duration: number) {
	const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';
	logger[level](`${method} ${url} ${status}`, { duration: `${duration}ms` });
}

// Error logging with stack trace
export function logError(error: Error, context?: string) {
	logger.error(error.message, {
		context,
		stack: error.stack,
		name: error.name
	});
}

export default logger;
