/**
 * Permission Service
 * Handles role-based access control for the application.
 */

import type { UserRole } from '$lib/server/db/schema';

// Minimal user type that only requires what we need for permission checking
interface UserWithRole {
	role: string | null;
}

// Permission types
export enum Permission {
	// Book permissions
	VIEW_BOOKS = 'view_books',
	ADD_BOOKS = 'add_books',
	EDIT_OWN_BOOKS = 'edit_own_books', // Edit user's personal reading data
	EDIT_BOOK_METADATA = 'edit_book_metadata', // Edit shared book metadata
	DELETE_BOOKS = 'delete_books',

	// Entity management (authors, series, genres, etc.)
	VIEW_ENTITIES = 'view_entities',
	MANAGE_ENTITIES = 'manage_entities',

	// Import/Export
	IMPORT_BOOKS = 'import_books',
	EXPORT_BOOKS = 'export_books',

	// Ebook access
	UPLOAD_EBOOKS = 'upload_ebooks',
	READ_EBOOKS = 'read_ebooks',

	// Stats
	VIEW_OWN_STATS = 'view_own_stats',
	VIEW_ALL_STATS = 'view_all_stats',

	// User management
	VIEW_USERS = 'view_users',
	MANAGE_USERS = 'manage_users',

	// Settings
	VIEW_SETTINGS = 'view_settings',
	MANAGE_SETTINGS = 'manage_settings',

	// Suggestions
	SUGGEST_EDITS = 'suggest_edits',
	REVIEW_SUGGESTIONS = 'review_suggestions',

	// Library management
	MANAGE_PUBLIC_LIBRARY = 'manage_public_library',
}

// Role definitions with their permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
	admin: [
		// Admin has all permissions
		Permission.VIEW_BOOKS,
		Permission.ADD_BOOKS,
		Permission.EDIT_OWN_BOOKS,
		Permission.EDIT_BOOK_METADATA,
		Permission.DELETE_BOOKS,
		Permission.VIEW_ENTITIES,
		Permission.MANAGE_ENTITIES,
		Permission.IMPORT_BOOKS,
		Permission.EXPORT_BOOKS,
		Permission.UPLOAD_EBOOKS,
		Permission.READ_EBOOKS,
		Permission.VIEW_OWN_STATS,
		Permission.VIEW_ALL_STATS,
		Permission.VIEW_USERS,
		Permission.MANAGE_USERS,
		Permission.VIEW_SETTINGS,
		Permission.MANAGE_SETTINGS,
		Permission.SUGGEST_EDITS,
		Permission.REVIEW_SUGGESTIONS,
		Permission.MANAGE_PUBLIC_LIBRARY,
	],

	librarian: [
		// Librarian can edit metadata and manage entities
		Permission.VIEW_BOOKS,
		Permission.ADD_BOOKS,
		Permission.EDIT_OWN_BOOKS,
		Permission.EDIT_BOOK_METADATA,
		Permission.VIEW_ENTITIES,
		Permission.MANAGE_ENTITIES,
		Permission.IMPORT_BOOKS,
		Permission.EXPORT_BOOKS,
		Permission.UPLOAD_EBOOKS,
		Permission.READ_EBOOKS,
		Permission.VIEW_OWN_STATS,
		Permission.SUGGEST_EDITS,
		Permission.REVIEW_SUGGESTIONS,
		Permission.MANAGE_PUBLIC_LIBRARY,
	],

	member: [
		// Member can manage their own library and suggest edits
		Permission.VIEW_BOOKS,
		Permission.ADD_BOOKS,
		Permission.EDIT_OWN_BOOKS,
		Permission.VIEW_ENTITIES,
		Permission.IMPORT_BOOKS,
		Permission.EXPORT_BOOKS,
		Permission.UPLOAD_EBOOKS,
		Permission.READ_EBOOKS,
		Permission.VIEW_OWN_STATS,
		Permission.SUGGEST_EDITS,
	],

	viewer: [
		// Viewer can read and download
		Permission.VIEW_BOOKS,
		Permission.VIEW_ENTITIES,
		Permission.READ_EBOOKS,
		Permission.VIEW_OWN_STATS,
	],

	guest: [
		// Guest can only view (no downloads)
		Permission.VIEW_BOOKS,
		Permission.VIEW_ENTITIES,
	],
};

// Role hierarchy (for checking if user has at least a certain role)
const ROLE_HIERARCHY: UserRole[] = ['admin', 'librarian', 'member', 'viewer', 'guest'];

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: UserWithRole | null, permission: Permission): boolean {
	if (!user) return false;

	const role = (user.role as UserRole) || 'member';
	const permissions = ROLE_PERMISSIONS[role] || [];

	return permissions.includes(permission);
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(user: UserWithRole | null, permissions: Permission[]): boolean {
	return permissions.every(p => hasPermission(user, p));
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: UserWithRole | null, permissions: Permission[]): boolean {
	return permissions.some(p => hasPermission(user, p));
}

/**
 * Check if a user has at least a certain role level
 */
export function hasRole(user: UserWithRole | null, minimumRole: UserRole): boolean {
	if (!user) return false;

	const userRole = (user.role as UserRole) || 'member';
	const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
	const minimumRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

	// Lower index = higher privilege
	return userRoleIndex !== -1 && userRoleIndex <= minimumRoleIndex;
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: UserWithRole | null): boolean {
	return user?.role === 'admin';
}

/**
 * Check if a user is a librarian or above
 */
export function isLibrarianOrAbove(user: UserWithRole | null): boolean {
	return hasRole(user, 'librarian');
}

/**
 * Check if a user can edit book metadata (librarian or admin)
 */
export function canEditMetadata(user: UserWithRole | null): boolean {
	return hasPermission(user, Permission.EDIT_BOOK_METADATA);
}

/**
 * Check if a user can review metadata suggestions
 */
export function canReviewSuggestions(user: UserWithRole | null): boolean {
	return hasPermission(user, Permission.REVIEW_SUGGESTIONS);
}

/**
 * Check if a user can manage the public library
 */
export function canManagePublicLibrary(user: UserWithRole | null): boolean {
	return hasPermission(user, Permission.MANAGE_PUBLIC_LIBRARY);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
	return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
	const names: Record<UserRole, string> = {
		admin: 'Administrator',
		librarian: 'Librarian',
		member: 'Member',
		viewer: 'Viewer',
		guest: 'Guest',
	};
	return names[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
	const descriptions: Record<UserRole, string> = {
		admin: 'Full access to all features including user management and settings',
		librarian: 'Can edit book metadata and manage entities. Can review edit suggestions.',
		member: 'Can manage personal library, suggest metadata edits, and read ebooks',
		viewer: 'Can browse books and read ebooks',
		guest: 'Can only browse books (no downloads)',
	};
	return descriptions[role] || '';
}

/**
 * Get all available roles
 */
export function getAllRoles(): UserRole[] {
	return [...ROLE_HIERARCHY];
}
