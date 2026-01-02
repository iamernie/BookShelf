import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { genres, statuses, books, magicShelves, userBooks } from '$lib/server/db/schema';
import { sql, eq, count, asc, or, and, ne, inArray } from 'drizzle-orm';
import { getAllShelves, getShelfBookCounts } from '$lib/server/services/magicShelfService';
import { getSettingAs } from '$lib/server/services/settingsService';
import { getLatestVersion, type ChangelogVersion } from '$lib/server/services/changelogService';
import { APP_CONFIG } from '$lib/config/app';

export const load: LayoutServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	// User library condition: books in user's personal library (user_books table)
	const userLibraryCondition = userId
		? sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		: sql`1=0`;

	// Get genres with book counts (user's library)
	const genresWithCounts = await db
		.select({
			id: genres.id,
			name: genres.name,
			color: genres.color,
			icon: genres.icon,
			bookCount: count(books.id)
		})
		.from(genres)
		.leftJoin(books, and(eq(books.genreId, genres.id), userLibraryCondition))
		.groupBy(genres.id)
		.orderBy(sql`count(${books.id}) DESC`);

	// Get statuses with book counts (user's library)
	const statusesWithCounts = await db
		.select({
			id: statuses.id,
			name: statuses.name,
			key: statuses.key,
			color: statuses.color,
			bookCount: count(books.id)
		})
		.from(statuses)
		.leftJoin(books, and(eq(books.statusId, statuses.id), userLibraryCondition))
		.groupBy(statuses.id)
		.orderBy(statuses.sortOrder);

	// Get total book count (user's library)
	const [{ total }] = await db
		.select({ total: count() })
		.from(books)
		.where(userLibraryCondition);

	// Get magic shelves for the current user
	let magicShelvesData: { id: number; name: string; iconColor: string | null; bookCount: number }[] = [];
	if (locals.user) {
		const shelves = await getAllShelves(locals.user.id);
		if (shelves.length > 0) {
			const counts = await getShelfBookCounts(shelves.map(s => s.id));
			magicShelvesData = shelves.map(shelf => ({
				id: shelf.id,
				name: shelf.name,
				iconColor: shelf.iconColor,
				bookCount: counts.get(shelf.id) || 0
			}));
		}
	}

	// Get public library setting
	const publicLibraryEnabled = await getSettingAs<boolean>('library.enable_public_library', 'boolean');

	// Get What's New modal data for admin users
	let whatsNewData: { show: boolean; version: string; changelog: ChangelogVersion | null } | null = null;
	if (locals.user?.role === 'admin') {
		// Check environment variable first
		const disabledByEnv = process.env.DISABLE_WHATS_NEW === 'true';

		if (!disabledByEnv) {
			// Check system setting
			const showModal = await getSettingAs<boolean>('ui.show_whats_new_modal', 'boolean');

			if (showModal) {
				const changelog = getLatestVersion();
				whatsNewData = {
					show: true,
					version: APP_CONFIG.version,
					changelog
				};
			}
		}
	}

	return {
		user: locals.user,
		sidebar: {
			genres: genresWithCounts,
			statuses: statusesWithCounts,
			magicShelves: magicShelvesData,
			totalBooks: total,
			isAdmin: locals.user?.role === 'admin',
			publicLibraryEnabled
		},
		whatsNew: whatsNewData
	};
};
