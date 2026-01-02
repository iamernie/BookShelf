import type { PageServerLoad } from './$types';
import { migrationStatus } from '$lib/server/db';

export const load: PageServerLoad = async () => {
	return {
		migrationStatus
	};
};
