import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { currentYearInAppTz } from '$lib/server/utils/appTime';
import { isAdmin } from '$lib/server/services/permissionService';
import {
	getActiveGoal,
	getAllGoals,
	getOrCreateCurrentYearGoal,
	updateGoal,
	createGoal,
	deleteGoal,
	getChallengesForYear,
	createChallenge,
	CHALLENGE_TYPES,
	GOAL_ICONS,
	type ChallengeType
} from '$lib/server/services/goalsService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const userId = locals.user.id;
	const currentYear = currentYearInAppTz();

	// Ensure a goal exists for the current year
	await getOrCreateCurrentYearGoal();

	const [currentGoal, allGoals, challenges] = await Promise.all([
		getActiveGoal(undefined, userId),
		getAllGoals(),
		getChallengesForYear(currentYear, userId)
	]);

	return {
		currentGoal,
		allGoals,
		challenges,
		challengeTypes: CHALLENGE_TYPES,
		goalIcons: GOAL_ICONS,
		currentYear,
		// Goals are instance-wide until per-user goals land, so only admins change them
		canEdit: isAdmin(locals.user)
	};
};

/** Goal writes change every user's goals: login, then admin, before the form is read */
function goalWriteDenied(user: App.Locals['user']) {
	if (!user) return fail(401, { error: 'Unauthorized' });
	if (!isAdmin(user)) return fail(403, { error: 'Only admins can change reading goals' });
	return null;
}

export const actions: Actions = {
	updateGoal: async ({ request, locals }) => {
		const denied = goalWriteDenied(locals.user);
		if (denied) return denied;

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string, 10);
		const target = parseInt(formData.get('target') as string, 10);
		const challengeType = (formData.get('challengeType') as ChallengeType) || 'books';
		const name = formData.get('name') as string;
		const icon = formData.get('icon') as string;

		if (isNaN(id) || isNaN(target) || target < 1) {
			return fail(400, { error: 'Invalid input' });
		}

		// Build update data based on challenge type
		const updateData: Record<string, unknown> = {
			name: name || null,
			icon: icon || null
		};
		switch (challengeType) {
			case 'books':
				updateData.targetBooks = target;
				break;
			case 'genres':
				updateData.targetGenres = target;
				break;
			case 'authors':
				updateData.targetAuthors = target;
				break;
			case 'formats':
				updateData.targetFormats = target;
				break;
			case 'pages':
				updateData.targetPages = target;
				break;
			case 'monthly':
				updateData.targetMonthly = target;
				break;
		}

		await updateGoal(id, updateData);
		return { success: true };
	},

	createGoal: async ({ request, locals }) => {
		const denied = goalWriteDenied(locals.user);
		if (denied) return denied;

		const formData = await request.formData();
		const year = parseInt(formData.get('year') as string, 10);
		const targetBooks = parseInt(formData.get('targetBooks') as string, 10);
		const name = formData.get('name') as string;

		if (isNaN(year) || isNaN(targetBooks) || targetBooks < 1) {
			return fail(400, { error: 'Invalid input' });
		}

		await createGoal({
			year,
			targetBooks,
			challengeType: 'books',
			name: name || null,
			isActive: true
		});

		return { success: true };
	},

	createChallenge: async ({ request, locals }) => {
		const denied = goalWriteDenied(locals.user);
		if (denied) return denied;

		const formData = await request.formData();
		const year = parseInt(formData.get('year') as string, 10);
		const challengeType = formData.get('challengeType') as ChallengeType;
		const target = parseInt(formData.get('target') as string, 10);
		const name = formData.get('name') as string;
		const icon = formData.get('icon') as string;

		if (isNaN(year) || !challengeType || isNaN(target) || target < 1) {
			return fail(400, { error: 'Invalid input' });
		}

		if (!CHALLENGE_TYPES[challengeType]) {
			return fail(400, { error: 'Invalid challenge type' });
		}

		try {
			await createChallenge({
				year,
				challengeType,
				target,
				name: name || undefined,
				icon: icon || undefined
			});
			return { success: true };
		} catch (error) {
			return fail(400, { error: error instanceof Error ? error.message : 'Failed to create challenge' });
		}
	},

	deleteGoal: async ({ request, locals }) => {
		const denied = goalWriteDenied(locals.user);
		if (denied) return denied;

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string, 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid input' });
		}

		await deleteGoal(id);
		return { success: true };
	}
};
