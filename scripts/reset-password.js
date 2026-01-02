#!/usr/bin/env node
/**
 * BookShelf V2 - Password Reset Script
 *
 * Usage:
 *   node scripts/reset-password.js <email> <new-password>
 *
 * Docker usage:
 *   docker exec -it bookshelf-v2 node scripts/reset-password.js admin@example.com newpassword123
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { existsSync } from 'fs';

const SALT_ROUNDS = 12;

async function resetPassword() {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error('Usage: node scripts/reset-password.js <email> <new-password>');
		console.error('');
		console.error('Docker example:');
		console.error('  docker exec -it bookshelf-v2 node scripts/reset-password.js admin@example.com newpassword123');
		process.exit(1);
	}

	const [email, newPassword] = args;

	if (newPassword.length < 8) {
		console.error('Error: Password must be at least 8 characters');
		process.exit(1);
	}

	// Find database path
	const databasePath = process.env.DATABASE_PATH || '/data/bookshelf.sqlite';

	if (!existsSync(databasePath)) {
		console.error(`Error: Database not found at ${databasePath}`);
		console.error('Set DATABASE_PATH environment variable if using a different location');
		process.exit(1);
	}

	console.log(`Using database: ${databasePath}`);

	const db = new Database(databasePath);

	// Find user by email
	const user = db.prepare('SELECT id, email, username FROM users WHERE LOWER(email) = LOWER(?)').get(email);

	if (!user) {
		console.error(`Error: No user found with email: ${email}`);

		// List available users
		const users = db.prepare('SELECT email, username FROM users').all();
		if (users.length > 0) {
			console.log('\nAvailable users:');
			users.forEach(u => console.log(`  - ${u.email} (${u.username})`));
		}

		db.close();
		process.exit(1);
	}

	// Hash the new password
	console.log(`Resetting password for: ${user.email} (${user.username})`);
	const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

	// Update the password
	const result = db.prepare(`
		UPDATE users
		SET password = ?,
		    failedLoginAttempts = 0,
		    lockoutUntil = NULL,
		    updatedAt = ?
		WHERE id = ?
	`).run(hashedPassword, new Date().toISOString(), user.id);

	db.close();

	if (result.changes > 0) {
		console.log('Password reset successfully!');
		console.log(`User ${user.email} can now log in with the new password.`);
	} else {
		console.error('Error: Failed to update password');
		process.exit(1);
	}
}

resetPassword().catch(err => {
	console.error('Error:', err.message);
	process.exit(1);
});
