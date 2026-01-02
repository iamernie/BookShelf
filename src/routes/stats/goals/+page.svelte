<script lang="ts">
	import {
		Target,
		Trophy,
		TrendingUp,
		TrendingDown,
		Calendar,
		BookOpen,
		Plus,
		Pencil,
		Trash2,
		ChevronLeft,
		Check,
		X,
		ArrowUp,
		ArrowDown,
		Minus,
		Layers,
		Users,
		Shapes,
		FileText,
		CalendarCheck,
		Book
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import type { ChallengeProgress } from '$lib/server/services/goalsService';
	import IconPicker from '$lib/components/ui/IconPicker.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';

	let { data } = $props();

	const currentGoal = data.currentGoal;
	const allGoals = data.allGoals;
	const challenges = data.challenges as ChallengeProgress[];
	const challengeTypes = data.challengeTypes;
	const goalIcons = data.goalIcons;
	const currentYear = data.currentYear;

	// UI state
	let editingGoal: number | null = $state(null);
	let editingChallenge: number | null = $state(null);
	let showNewGoalForm = $state(false);
	let showNewChallengeForm = $state(false);
	let newGoalYear = $state(currentYear + 1);
	let newGoalTarget = $state(12);
	let editTarget = $state(12);
	let editIcon = $state('');
	let newChallengeType = $state<string>('genres');
	let newChallengeTarget = $state(6);
	let newChallengeIcon = $state('');

	// Get icon component for challenge type (fallback for when LucideIcon can't be used)
	function getChallengeIcon(iconName: string) {
		const icons: Record<string, typeof Book> = {
			book: Book,
			layers: Layers,
			users: Users,
			shapes: Shapes,
			'file-text': FileText,
			'calendar-check': CalendarCheck
		};
		return icons[iconName] || Target;
	}

	// Get available challenge types (ones not already created)
	const availableChallengeTypes = $derived(
		Object.entries(challengeTypes).filter(
			([key]) => !challenges.some((c) => c.type === key)
		)
	);

	// Calculate progress bar segments
	function getProgressSegments(progress: number) {
		const segments = [];
		const total = 100;
		const filled = Math.min(progress, total);
		const remaining = total - filled;

		if (filled > 0) {
			segments.push({ width: filled, type: 'filled' });
		}
		if (remaining > 0) {
			segments.push({ width: remaining, type: 'empty' });
		}

		return segments;
	}

	function getPaceColor(status: string) {
		switch (status) {
			case 'ahead':
				return '#22c55e';
			case 'behind':
				return '#ef4444';
			default:
				return '#eab308';
		}
	}
</script>

<svelte:head>
	<title>Reading Goals - BookShelf</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
	<!-- Header -->
	<div class="mb-8 flex items-center gap-4">
		<a href="/stats" class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style="color: var(--text-muted);">
			<ChevronLeft class="w-5 h-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Reading Goals</h1>
			<p class="mt-1" style="color: var(--text-muted);">Track your reading progress and set yearly goals</p>
		</div>
	</div>

	<!-- Current Year Goal -->
	{#if currentGoal}
		<div class="goal-hero mb-8" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
			<div class="flex items-start justify-between mb-6">
				<div>
					<div class="flex items-center gap-2 text-white/80 text-sm mb-1">
						<Calendar class="w-4 h-4" />
						<span>{currentGoal.goal.year} Reading Challenge</span>
					</div>
					<h2 class="text-3xl font-bold text-white">
						{currentGoal.goal.name || `${currentGoal.goal.year} Reading Goal`}
					</h2>
				</div>
				{#if currentGoal.progress >= 100}
					<div class="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
						<Trophy class="w-5 h-5 text-yellow-300" />
						<span class="text-white font-medium">Goal Achieved!</span>
					</div>
				{/if}
			</div>

			<!-- Progress -->
			<div class="mb-6">
				<div class="flex justify-between items-end mb-3">
					<div>
						<span class="text-5xl font-bold text-white">{currentGoal.booksRead}</span>
						<span class="text-white/70 text-xl"> / {currentGoal.goal.targetBooks} books</span>
					</div>
					<div class="text-right">
						<div class="text-4xl font-bold text-white">{currentGoal.progress}%</div>
						<div class="text-white/70 text-sm">Complete</div>
					</div>
				</div>
				<div class="h-4 bg-white/20 rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-500"
						style="width: {currentGoal.progress}%; background-color: white;"
					></div>
				</div>
			</div>

			<!-- Pace Status -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-full flex items-center justify-center"
						style="background-color: {getPaceColor(currentGoal.paceStatus)}20;"
					>
						{#if currentGoal.paceStatus === 'ahead'}
							<ArrowUp class="w-5 h-5" style="color: {getPaceColor(currentGoal.paceStatus)};" />
						{:else if currentGoal.paceStatus === 'behind'}
							<ArrowDown class="w-5 h-5" style="color: {getPaceColor(currentGoal.paceStatus)};" />
						{:else}
							<Minus class="w-5 h-5" style="color: {getPaceColor(currentGoal.paceStatus)};" />
						{/if}
					</div>
					<div>
						<div class="text-white font-medium">
							{#if currentGoal.paceStatus === 'ahead'}
								{currentGoal.paceDiff} books ahead of schedule
							{:else if currentGoal.paceStatus === 'behind'}
								{currentGoal.paceDiff} books behind schedule
							{:else}
								On track!
							{/if}
						</div>
						<div class="text-white/70 text-sm">
							Expected: {currentGoal.expectedByNow} books by now
						</div>
					</div>
				</div>
				<div class="text-right">
					<div class="text-white font-medium">{currentGoal.remaining} remaining</div>
					<div class="text-white/70 text-sm">to reach goal</div>
				</div>
			</div>
		</div>

		<!-- Monthly Breakdown -->
		<div class="card mb-8">
			<div class="card-header">
				<div class="flex items-center gap-2">
					<BookOpen class="w-5 h-5" style="color: var(--accent);" />
					<h3 class="font-semibold" style="color: var(--text-primary);">Monthly Breakdown</h3>
				</div>
			</div>
			<div class="p-4">
				<div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
					{#each currentGoal.monthlyBreakdown as month, i}
						{@const isCurrentMonth = i === new Date().getMonth() && currentGoal.goal.year === currentYear}
						<div
							class="text-center p-2 rounded-lg transition-colors"
							class:ring-2={isCurrentMonth}
							class:ring-emerald-500={isCurrentMonth}
							style="background-color: var(--bg-tertiary);"
						>
							<div class="text-xs mb-1" style="color: var(--text-muted);">{month.month}</div>
							<div
								class="text-lg font-bold"
								style="color: {month.count > 0 ? 'var(--accent)' : 'var(--text-muted)'};"
							>
								{month.count}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Reading Challenges -->
	<div class="card mb-8">
		<div class="card-header flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Trophy class="w-5 h-5" style="color: var(--accent);" />
				<h3 class="font-semibold" style="color: var(--text-primary);">{currentYear} Reading Challenges</h3>
			</div>
			{#if availableChallengeTypes.length > 0}
				<button
					onclick={() => {
						showNewChallengeForm = !showNewChallengeForm;
						if (availableChallengeTypes.length > 0) {
							const firstAvailable = availableChallengeTypes[0];
							newChallengeType = firstAvailable[0];
							newChallengeTarget = firstAvailable[1].defaultTarget;
						}
					}}
					class="btn-secondary text-sm"
				>
					<Plus class="w-4 h-4" />
					Add Challenge
				</button>
			{/if}
		</div>

		{#if showNewChallengeForm}
			<form
				method="POST"
				action="?/createChallenge"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							showNewChallengeForm = false;
							newChallengeIcon = '';
						}
						await update();
					};
				}}
				class="p-4 border-b"
				style="background-color: var(--bg-tertiary); border-color: var(--border-color);"
			>
				<input type="hidden" name="year" value={currentYear} />
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
					<div>
						<label class="text-xs block mb-1" style="color: var(--text-muted);">Challenge Type</label>
						<select
							name="challengeType"
							bind:value={newChallengeType}
							onchange={(e) => {
								const type = challengeTypes[e.currentTarget.value as keyof typeof challengeTypes];
								if (type) newChallengeTarget = type.defaultTarget;
							}}
							class="input w-full"
						>
							{#each availableChallengeTypes as [key, type]}
								<option value={key}>{type.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="text-xs block mb-1" style="color: var(--text-muted);">Target</label>
						<input
							type="number"
							name="target"
							bind:value={newChallengeTarget}
							min="1"
							class="input w-full"
						/>
					</div>
					<div>
						<label class="text-xs block mb-1" style="color: var(--text-muted);">Name (optional)</label>
						<input
							type="text"
							name="name"
							placeholder="Custom name"
							class="input w-full"
						/>
					</div>
					<div>
						<label class="text-xs block mb-1" style="color: var(--text-muted);">Icon (optional)</label>
						<IconPicker icons={goalIcons} bind:value={newChallengeIcon} placeholder="Default icon" />
					</div>
				</div>
				{#if challengeTypes[newChallengeType as keyof typeof challengeTypes]}
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						{challengeTypes[newChallengeType as keyof typeof challengeTypes].description}
					</p>
				{/if}
				<div class="flex gap-2">
					<button type="submit" class="btn-primary text-sm">
						<Check class="w-4 h-4" />
						Create Challenge
					</button>
					<button type="button" onclick={() => (showNewChallengeForm = false)} class="btn-secondary text-sm">
						Cancel
					</button>
				</div>
			</form>
		{/if}

		<div class="p-4">
			{#if challenges.length === 0}
				<div class="text-center py-8" style="color: var(--text-muted);">
					<Target class="w-12 h-12 mx-auto mb-3 opacity-50" />
					<p>No challenges set for {currentYear}</p>
					<p class="text-sm mt-1">Add challenges to track different reading goals</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each challenges as challenge}
						<div
							class="challenge-card p-4 rounded-lg relative"
							class:complete={challenge.isComplete}
							style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color);"
						>
							{#if challenge.isComplete}
								<div class="absolute top-2 right-2">
									<div class="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
										<Check class="w-4 h-4 text-white" />
									</div>
								</div>
							{/if}

							<div class="flex items-start gap-3 mb-3">
								<div
									class="w-10 h-10 rounded-lg flex items-center justify-center"
									style="background-color: color-mix(in srgb, var(--accent) 15%, transparent);"
								>
									<LucideIcon name={challenge.icon} size={20} color="var(--accent)" />
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="font-medium truncate" style="color: var(--text-primary);">
										{challenge.challenge.name || challenge.typeInfo.name}
									</h4>
									<p class="text-xs" style="color: var(--text-muted);">
										{challenge.typeInfo.description}
									</p>
								</div>
							</div>

							<div class="mb-2">
								<div class="flex justify-between text-sm mb-1">
									<span style="color: var(--text-muted);">
										{challenge.current} / {challenge.target} {challenge.typeInfo.unit}
									</span>
									<span class="font-medium" style="color: {challenge.isComplete ? '#22c55e' : 'var(--accent)'};">
										{challenge.progress}%
									</span>
								</div>
								<div class="h-2 rounded-full overflow-hidden" style="background-color: var(--border-color);">
									<div
										class="h-full rounded-full transition-all duration-300"
										style="width: {challenge.progress}%; background-color: {challenge.isComplete ? '#22c55e' : 'var(--accent)'};"
									></div>
								</div>
							</div>

							<div class="flex justify-between items-center">
								<span class="text-xs" style="color: var(--text-muted);">
									{challenge.remaining} remaining
								</span>
								<div class="flex gap-1">
									<button
										onclick={() => {
											editingChallenge = challenge.challenge.id;
											editTarget = challenge.target;
											editIcon = challenge.challenge.icon || '';
										}}
										class="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
										style="color: var(--text-muted);"
										title="Edit challenge"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>
									<form method="POST" action="?/deleteGoal" use:enhance class="inline">
										<input type="hidden" name="id" value={challenge.challenge.id} />
										<button
											type="submit"
											class="p-1 rounded hover:bg-red-500/20"
											style="color: #ef4444;"
											title="Delete challenge"
											onclick={(e) => {
												if (!confirm(`Delete ${challenge.typeInfo.name} challenge?`)) {
													e.preventDefault();
												}
											}}
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							</div>

							{#if editingChallenge === challenge.challenge.id}
								<form
									method="POST"
									action="?/updateGoal"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (result.type === 'success') {
												editingChallenge = null;
												editIcon = '';
											}
											await update();
										};
									}}
									class="mt-3 pt-3 border-t"
									style="border-color: var(--border-color);"
								>
									<input type="hidden" name="id" value={challenge.challenge.id} />
									<input type="hidden" name="challengeType" value={challenge.type} />
									<div class="space-y-3">
										<div class="flex gap-2">
											<div class="flex-1">
												<label class="text-xs block mb-1" style="color: var(--text-muted);">Target</label>
												<input
													type="number"
													name="target"
													bind:value={editTarget}
													min="1"
													class="input w-full"
												/>
											</div>
										</div>
										<div>
											<label class="text-xs block mb-1" style="color: var(--text-muted);">Icon</label>
											<IconPicker icons={goalIcons} bind:value={editIcon} placeholder="Default icon" />
										</div>
										<div class="flex gap-2">
											<button type="submit" class="btn-primary text-sm flex-1">
												<Check class="w-4 h-4" />
												Save
											</button>
											<button type="button" onclick={() => { editingChallenge = null; editIcon = ''; }} class="btn-secondary text-sm">
												Cancel
											</button>
										</div>
									</div>
								</form>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if !currentGoal}
		<!-- No Goal Set -->
		<div class="card mb-8 text-center py-12">
			<Target class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			<h2 class="text-xl font-bold mb-2" style="color: var(--text-primary);">No Reading Goal Set</h2>
			<p class="mb-6" style="color: var(--text-muted);">Set a reading goal to track your progress this year</p>
			<button
				onclick={() => (showNewGoalForm = true)}
				class="btn-primary"
			>
				<Plus class="w-4 h-4" />
				Set {currentYear} Goal
			</button>
		</div>
	{/if}

	<!-- All Goals -->
	<div class="card">
		<div class="card-header flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Calendar class="w-5 h-5" style="color: var(--accent);" />
				<h3 class="font-semibold" style="color: var(--text-primary);">All Reading Goals</h3>
			</div>
			<button
				onclick={() => (showNewGoalForm = true)}
				class="btn-secondary text-sm"
			>
				<Plus class="w-4 h-4" />
				New Goal
			</button>
		</div>
		<div class="divide-y" style="border-color: var(--border-color);">
			{#if showNewGoalForm}
				<form
					method="POST"
					action="?/createGoal"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								showNewGoalForm = false;
							}
							await update();
						};
					}}
					class="p-4 flex items-center gap-4"
					style="background-color: var(--bg-tertiary);"
				>
					<input type="hidden" name="year" value={newGoalYear} />
					<div class="flex-1 grid grid-cols-3 gap-4">
						<div>
							<label class="text-xs block mb-1" style="color: var(--text-muted);">Year</label>
							<input
								type="number"
								bind:value={newGoalYear}
								min="2000"
								max="2100"
								class="input w-full"
							/>
						</div>
						<div>
							<label class="text-xs block mb-1" style="color: var(--text-muted);">Target Books</label>
							<input
								type="number"
								name="targetBooks"
								bind:value={newGoalTarget}
								min="1"
								class="input w-full"
							/>
						</div>
						<div>
							<label class="text-xs block mb-1" style="color: var(--text-muted);">Name (optional)</label>
							<input
								type="text"
								name="name"
								placeholder="e.g. 2025 Challenge"
								class="input w-full"
							/>
						</div>
					</div>
					<div class="flex gap-2">
						<button type="submit" class="p-2 rounded-lg hover:bg-emerald-500/20" style="color: #22c55e;">
							<Check class="w-5 h-5" />
						</button>
						<button type="button" onclick={() => (showNewGoalForm = false)} class="p-2 rounded-lg hover:bg-red-500/20" style="color: #ef4444;">
							<X class="w-5 h-5" />
						</button>
					</div>
				</form>
			{/if}

			{#each allGoals as goal}
				<div class="p-4 flex items-center gap-4">
					{#if editingGoal === goal.id}
						<form
							method="POST"
							action="?/updateGoal"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										editingGoal = null;
									}
									await update();
								};
							}}
							class="flex-1 flex items-center gap-4"
						>
							<input type="hidden" name="id" value={goal.id} />
							<input type="hidden" name="challengeType" value={goal.challengeType || 'books'} />
							<div class="flex-1 grid grid-cols-2 gap-4">
								<div>
									<label class="text-xs block mb-1" style="color: var(--text-muted);">Target Books</label>
									<input
										type="number"
										name="target"
										bind:value={editTarget}
										min="1"
										class="input w-full"
									/>
								</div>
								<div>
									<label class="text-xs block mb-1" style="color: var(--text-muted);">Name</label>
									<input
										type="text"
										name="name"
										value={goal.name || ''}
										placeholder="Goal name"
										class="input w-full"
									/>
								</div>
							</div>
							<div class="flex gap-2">
								<button type="submit" class="p-2 rounded-lg hover:bg-emerald-500/20" style="color: #22c55e;">
									<Check class="w-5 h-5" />
								</button>
								<button type="button" onclick={() => (editingGoal = null)} class="p-2 rounded-lg hover:bg-red-500/20" style="color: #ef4444;">
									<X class="w-5 h-5" />
								</button>
							</div>
						</form>
					{:else}
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<span class="text-lg font-bold" style="color: var(--text-primary);">{goal.year}</span>
								{#if goal.name}
									<span style="color: var(--text-muted);">- {goal.name}</span>
								{/if}
								{#if goal.year === currentYear}
									<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--accent); color: white;">
										Current
									</span>
								{/if}
							</div>
							<div class="text-sm mt-1" style="color: var(--text-muted);">
								Target: {goal.targetBooks} books
							</div>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => {
									editingGoal = goal.id;
									editTarget = goal.targetBooks || 12;
								}}
								class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
								style="color: var(--text-muted);"
							>
								<Pencil class="w-4 h-4" />
							</button>
							{#if goal.year !== currentYear}
								<form method="POST" action="?/deleteGoal" use:enhance>
									<input type="hidden" name="id" value={goal.id} />
									<button
										type="submit"
										class="p-2 rounded-lg hover:bg-red-500/20"
										style="color: #ef4444;"
										onclick={(e) => {
											if (!confirm('Delete this goal?')) {
												e.preventDefault();
											}
										}}
									>
										<Trash2 class="w-4 h-4" />
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if allGoals.length === 0}
				<div class="p-8 text-center" style="color: var(--text-muted);">
					No reading goals yet. Create your first goal above!
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.goal-hero {
		border-radius: 1rem;
		padding: 2rem;
	}

	.card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.card-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background-color: var(--accent);
		color: white;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--bg-tertiary);
		color: var(--text-primary);
		border-radius: 0.5rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-secondary:hover {
		background-color: var(--border-color);
	}

	.input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.divide-y > * + * {
		border-top: 1px solid var(--border-color);
	}

	.challenge-card {
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.challenge-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.challenge-card.complete {
		border-color: #22c55e !important;
	}

	select.input {
		appearance: none;
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.5rem center;
		background-repeat: no-repeat;
		background-size: 1.5em 1.5em;
		padding-right: 2.5rem;
	}
</style>
