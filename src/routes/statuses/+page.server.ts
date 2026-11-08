import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/services/permissionService';

// The list itself loads client-side; renaming is admin-only (statuses drive the ABS lookups)
export const load: PageServerLoad = async ({ locals }) => ({
	canEdit: isAdmin(locals.user ?? null)
});
