import { db, readingGoals, books, statuses, genres, formats, bookAuthors, authors } from '$lib/server/db';
import { eq, and, gte, lt, sql, or, count, countDistinct } from 'drizzle-orm';
import type { ReadingGoal, NewReadingGoal } from '$lib/server/db/schema';

const STATUS_READ = 'READ';

// Available icons for goals/challenges (lucide icon names)
export const GOAL_ICONS = [
	'book', 'book-open', 'library', 'bookmark', 'bookmarks',
	'target', 'trophy', 'award', 'medal', 'star',
	'layers', 'users', 'shapes', 'file-text', 'calendar-check',
	'flame', 'zap', 'rocket', 'sparkles', 'crown',
	'heart', 'thumbs-up', 'check-circle', 'flag', 'mountain',
	'sunrise', 'moon', 'sun', 'cloud', 'compass',
	'map', 'globe', 'graduation-cap', 'brain', 'lightbulb',
	'music', 'headphones', 'mic', 'coffee', 'glasses'
] as const;

// Challenge type definitions
export const CHALLENGE_TYPES = {
	books: {
		key: 'books',
		name: 'Book Count',
		icon: 'book',
		description: 'Read a target number of books',
		targetField: 'targetBooks',
		unit: 'books',
		defaultTarget: 12
	},
	genres: {
		key: 'genres',
		name: 'Genre Diversity',
		icon: 'layers',
		description: 'Read books from different genres',
		targetField: 'targetGenres',
		unit: 'genres',
		defaultTarget: 6
	},
	authors: {
		key: 'authors',
		name: 'Author Diversity',
		icon: 'users',
		description: 'Read books by different authors',
		targetField: 'targetAuthors',
		unit: 'authors',
		defaultTarget: 12
	},
	formats: {
		key: 'formats',
		name: 'Format Variety',
		icon: 'shapes',
		description: 'Read books in different formats',
		targetField: 'targetFormats',
		unit: 'formats',
		defaultTarget: 3
	},
	pages: {
		key: 'pages',
		name: 'Page Count',
		icon: 'file-text',
		description: 'Read a target number of pages',
		targetField: 'targetPages',
		unit: 'pages',
		defaultTarget: 5000
	},
	monthly: {
		key: 'monthly',
		name: 'Monthly Consistency',
		icon: 'calendar-check',
		description: 'Read consistently every month',
		targetField: 'targetMonthly',
		unit: 'months',
		defaultTarget: 2
	}
} as const;

export type ChallengeType = keyof typeof CHALLENGE_TYPES;

export interface GoalProgress {
	goal: ReadingGoal;
	booksRead: number;
	progress: number;
	remaining: number;
	paceStatus: 'ahead' | 'behind' | 'on_track';
	paceDiff: number;
	expectedByNow: number;
	monthlyBreakdown: { month: string; count: number }[];
}

export interface ChallengeProgress {
	challenge: ReadingGoal;
	type: ChallengeType;
	typeInfo: (typeof CHALLENGE_TYPES)[ChallengeType];
	current: number;
	target: number;
	progress: number;
	remaining: number;
	isComplete: boolean;
	icon: string; // Custom icon or default from typeInfo
}

// Helper to get READ status ID
async function getReadStatusId(): Promise<number | null> {
	const readStatus = await db
		.select()
		.from(statuses)
		.where(eq(statuses.key, STATUS_READ))
		.limit(1);
	return readStatus[0]?.id ?? null;
}

// Helper for user library condition
function getUserLibraryCondition(userId?: number) {
	return userId
		? or(
				eq(books.libraryType, 'personal'),
				sql`${books.id} IN (SELECT bookId FROM user_books WHERE userId = ${userId})`
		  )
		: eq(books.libraryType, 'personal');
}

// Calculate books read for a year
async function calculateBooksProgress(year: number, userId?: number): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		);

	return result[0]?.count ?? 0;
}

// Calculate distinct genres read
async function calculateGenresProgress(year: number, userId?: number): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	const result = await db
		.select({ count: sql<number>`count(DISTINCT genreId)` })
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				sql`genreId IS NOT NULL`,
				userLibraryCondition
			)
		);

	return result[0]?.count ?? 0;
}

// Calculate distinct authors read
async function calculateAuthorsProgress(year: number, userId?: number): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	// Count distinct authors from books read this year
	const result = await db
		.select({ count: sql<number>`count(DISTINCT ${bookAuthors.authorId})` })
		.from(books)
		.innerJoin(bookAuthors, eq(books.id, bookAuthors.bookId))
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		);

	return result[0]?.count ?? 0;
}

// Calculate distinct formats read
async function calculateFormatsProgress(year: number, userId?: number): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	const result = await db
		.select({ count: sql<number>`count(DISTINCT formatId)` })
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				sql`formatId IS NOT NULL`,
				userLibraryCondition
			)
		);

	return result[0]?.count ?? 0;
}

// Calculate total pages read
async function calculatePagesProgress(year: number, userId?: number): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	const result = await db
		.select({ total: sql<number>`COALESCE(SUM(pageCount), 0)` })
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		);

	return result[0]?.total ?? 0;
}

// Calculate months meeting target
async function calculateMonthlyProgress(
	year: number,
	targetPerMonth: number,
	userId?: number
): Promise<number> {
	const readStatusId = await getReadStatusId();
	if (!readStatusId) return 0;

	const yearStart = `${year}-01-01`;
	const yearEnd = `${year + 1}-01-01`;
	const userLibraryCondition = getUserLibraryCondition(userId);

	// Get count per month
	const monthlyResult = await db
		.select({
			month: sql<string>`strftime('%m', completedDate)`,
			count: sql<number>`count(*)`
		})
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		)
		.groupBy(sql`strftime('%m', completedDate)`);

	// Count months meeting target (skip future months)
	const now = new Date();
	const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;

	let monthsMeetingTarget = 0;
	for (let m = 1; m <= currentMonth; m++) {
		const monthNum = String(m).padStart(2, '0');
		const data = monthlyResult.find((r) => r.month === monthNum);
		if ((data?.count ?? 0) >= targetPerMonth) {
			monthsMeetingTarget++;
		}
	}

	return monthsMeetingTarget;
}

// Calculate progress for any challenge type
async function calculateChallengeProgress(
	challenge: ReadingGoal,
	userId?: number
): Promise<number> {
	const type = (challenge.challengeType || 'books') as ChallengeType;
	const year = challenge.year;

	switch (type) {
		case 'books':
			return calculateBooksProgress(year, userId);
		case 'genres':
			return calculateGenresProgress(year, userId);
		case 'authors':
			return calculateAuthorsProgress(year, userId);
		case 'formats':
			return calculateFormatsProgress(year, userId);
		case 'pages':
			return calculatePagesProgress(year, userId);
		case 'monthly':
			return calculateMonthlyProgress(year, challenge.targetMonthly || 2, userId);
		default:
			return calculateBooksProgress(year, userId);
	}
}

// Get target value for a challenge
function getChallengeTarget(challenge: ReadingGoal): number {
	const type = (challenge.challengeType || 'books') as ChallengeType;

	switch (type) {
		case 'books':
			return challenge.targetBooks || 12;
		case 'genres':
			return challenge.targetGenres || 6;
		case 'authors':
			return challenge.targetAuthors || 12;
		case 'formats':
			return challenge.targetFormats || 3;
		case 'pages':
			return challenge.targetPages || 5000;
		case 'monthly':
			return 12; // Always 12 months
		default:
			return challenge.targetBooks || 12;
	}
}

export async function getActiveGoal(year?: number, userId?: number): Promise<GoalProgress | null> {
	const targetYear = year || new Date().getFullYear();

	// Get the main book goal for this year (challengeType = 'books' or null)
	const goals = await db
		.select()
		.from(readingGoals)
		.where(
			and(
				eq(readingGoals.year, targetYear),
				eq(readingGoals.isActive, true),
				or(eq(readingGoals.challengeType, 'books'), sql`challengeType IS NULL`)
			)
		)
		.limit(1);

	const goal = goals[0];
	if (!goal) {
		return null;
	}

	const readStatusId = await getReadStatusId();
	const userLibraryCondition = getUserLibraryCondition(userId);

	if (!readStatusId) {
		return {
			goal,
			booksRead: 0,
			progress: 0,
			remaining: goal.targetBooks || 0,
			paceStatus: 'behind',
			paceDiff: 0,
			expectedByNow: 0,
			monthlyBreakdown: []
		};
	}

	// Calculate books read this year
	const yearStart = `${targetYear}-01-01`;
	const yearEnd = `${targetYear + 1}-01-01`;

	const booksReadResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		);

	const booksRead = booksReadResult[0]?.count ?? 0;

	// Calculate monthly breakdown
	const monthlyResult = await db
		.select({
			month: sql<string>`strftime('%m', completedDate)`,
			count: sql<number>`count(*)`
		})
		.from(books)
		.where(
			and(
				eq(books.statusId, readStatusId),
				gte(books.completedDate, yearStart),
				lt(books.completedDate, yearEnd),
				userLibraryCondition
			)
		)
		.groupBy(sql`strftime('%m', completedDate)`);

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const monthlyBreakdown = monthNames.map((name, i) => {
		const monthNum = String(i + 1).padStart(2, '0');
		const data = monthlyResult.find((m) => m.month === monthNum);
		return { month: name, count: data?.count ?? 0 };
	});

	// Calculate progress
	const targetBooks = goal.targetBooks || 12;
	const progress = targetBooks > 0 ? Math.round((booksRead / targetBooks) * 100) : 0;
	const remaining = Math.max(0, targetBooks - booksRead);

	// Calculate pace
	const now = new Date();
	const isCurrentYear = targetYear === now.getFullYear();
	let expectedByNow = 0;
	let paceStatus: 'ahead' | 'behind' | 'on_track' = 'on_track';
	let paceDiff = 0;

	if (isCurrentYear) {
		const dayOfYear = Math.floor(
			(now.getTime() - new Date(targetYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)
		);
		const daysInYear = targetYear % 4 === 0 ? 366 : 365;
		expectedByNow = Math.floor((targetBooks * dayOfYear) / daysInYear);
		paceDiff = Math.abs(booksRead - expectedByNow);

		if (booksRead > expectedByNow) {
			paceStatus = 'ahead';
		} else if (booksRead < expectedByNow) {
			paceStatus = 'behind';
		}
	} else {
		expectedByNow = targetBooks;
		paceDiff = Math.abs(booksRead - targetBooks);
		paceStatus = booksRead >= targetBooks ? 'ahead' : 'behind';
	}

	return {
		goal,
		booksRead,
		progress: Math.min(progress, 100),
		remaining,
		paceStatus,
		paceDiff,
		expectedByNow,
		monthlyBreakdown
	};
}

// Get all challenges for a year with progress
export async function getChallengesForYear(
	year: number,
	userId?: number
): Promise<ChallengeProgress[]> {
	const challenges = await db
		.select()
		.from(readingGoals)
		.where(and(eq(readingGoals.year, year), eq(readingGoals.isActive, true)));

	const result: ChallengeProgress[] = [];

	for (const challenge of challenges) {
		const type = (challenge.challengeType || 'books') as ChallengeType;
		const typeInfo = CHALLENGE_TYPES[type] || CHALLENGE_TYPES.books;
		const current = await calculateChallengeProgress(challenge, userId);
		const target = getChallengeTarget(challenge);
		const progress = target > 0 ? Math.round((current / target) * 100) : 0;

		result.push({
			challenge,
			type,
			typeInfo,
			current,
			target,
			progress: Math.min(progress, 100),
			remaining: Math.max(0, target - current),
			isComplete: current >= target,
			icon: challenge.icon || typeInfo.icon
		});
	}

	return result;
}

// Get goal data formatted for dashboard display
export async function getGoalForDashboard(userId?: number): Promise<{
	year: number;
	targetBooks: number;
	booksRead: number;
	progress: number;
	paceStatus: 'ahead' | 'behind' | 'on_track';
	paceDiff: number;
	expectedByNow: number;
	remaining: number;
	challenges: ChallengeProgress[];
} | null> {
	const currentYear = new Date().getFullYear();
	const goalProgress = await getActiveGoal(currentYear, userId);

	if (!goalProgress) {
		return null;
	}

	const challenges = await getChallengesForYear(currentYear, userId);

	return {
		year: goalProgress.goal.year,
		targetBooks: goalProgress.goal.targetBooks || 12,
		booksRead: goalProgress.booksRead,
		progress: goalProgress.progress,
		paceStatus: goalProgress.paceStatus,
		paceDiff: goalProgress.paceDiff,
		expectedByNow: goalProgress.expectedByNow,
		remaining: goalProgress.remaining,
		challenges
	};
}

export async function getAllGoals(): Promise<ReadingGoal[]> {
	return db.select().from(readingGoals).orderBy(sql`year DESC`);
}

export async function getGoalById(id: number): Promise<ReadingGoal | null> {
	const goals = await db.select().from(readingGoals).where(eq(readingGoals.id, id)).limit(1);
	return goals[0] || null;
}

export async function createGoal(data: NewReadingGoal): Promise<ReadingGoal> {
	const now = new Date().toISOString();
	const result = await db
		.insert(readingGoals)
		.values({
			...data,
			challengeType: data.challengeType || 'books',
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return result[0];
}

export async function createChallenge(data: {
	year: number;
	challengeType: ChallengeType;
	target: number;
	name?: string;
	icon?: string;
}): Promise<ReadingGoal> {
	const { year, challengeType, target, name, icon } = data;

	// Check if challenge type already exists for this year
	const existing = await db
		.select()
		.from(readingGoals)
		.where(
			and(
				eq(readingGoals.year, year),
				eq(readingGoals.challengeType, challengeType),
				eq(readingGoals.isActive, true)
			)
		)
		.limit(1);

	if (existing[0]) {
		throw new Error(`A ${CHALLENGE_TYPES[challengeType].name} challenge already exists for ${year}`);
	}

	const now = new Date().toISOString();
	const typeInfo = CHALLENGE_TYPES[challengeType];

	// Build the target field dynamically
	const targetData: Partial<NewReadingGoal> = {
		year,
		challengeType,
		name,
		icon: icon || null,
		isActive: true,
		createdAt: now,
		updatedAt: now
	};

	// Set the appropriate target field
	switch (challengeType) {
		case 'books':
			targetData.targetBooks = target;
			break;
		case 'genres':
			targetData.targetGenres = target;
			break;
		case 'authors':
			targetData.targetAuthors = target;
			break;
		case 'formats':
			targetData.targetFormats = target;
			break;
		case 'pages':
			targetData.targetPages = target;
			break;
		case 'monthly':
			targetData.targetMonthly = target;
			break;
	}

	const result = await db.insert(readingGoals).values(targetData as NewReadingGoal).returning();
	return result[0];
}

export async function updateGoal(
	id: number,
	data: Partial<NewReadingGoal>
): Promise<ReadingGoal | null> {
	const now = new Date().toISOString();
	const result = await db
		.update(readingGoals)
		.set({ ...data, updatedAt: now })
		.where(eq(readingGoals.id, id))
		.returning();
	return result[0] || null;
}

export async function deleteGoal(id: number): Promise<boolean> {
	const result = await db.delete(readingGoals).where(eq(readingGoals.id, id));
	return result.changes > 0;
}

export async function getOrCreateCurrentYearGoal(): Promise<ReadingGoal> {
	const currentYear = new Date().getFullYear();

	// Check if a book goal exists for current year
	const existing = await db
		.select()
		.from(readingGoals)
		.where(
			and(
				eq(readingGoals.year, currentYear),
				or(eq(readingGoals.challengeType, 'books'), sql`challengeType IS NULL`)
			)
		)
		.limit(1);

	if (existing[0]) {
		return existing[0];
	}

	// Create a new book goal
	return createGoal({
		year: currentYear,
		targetBooks: 12,
		challengeType: 'books',
		isActive: true
	});
}
