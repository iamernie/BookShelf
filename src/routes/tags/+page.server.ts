import type { PageServerLoad } from './$types';
import { canManageEntities, hasPermission, Permission } from '$lib/server/services/permissionService';

// The list itself loads client-side; the flags gate Add and where a card leads
export const load: PageServerLoad = async ({ locals }) => ({
	// Editing and deleting are catalog-editor writes; creating stays open to book adders (D3)
	canEdit: canManageEntities(locals.user ?? null),
	canCreate: hasPermission(locals.user ?? null, Permission.ADD_BOOKS)
});
