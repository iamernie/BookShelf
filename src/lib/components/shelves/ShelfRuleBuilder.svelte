<script lang="ts">
	import { X, Plus, Trash2 } from 'lucide-svelte';
	import type { FilterRule, FilterGroup, FilterConfig, FilterOperator } from '$lib/server/services/magicShelfService';

	interface OptionItem {
		id: number;
		name: string;
	}

	let {
		filterConfig = $bindable(),
		statuses = [],
		genres = [],
		formats = [],
		authors = [],
		series = [],
		tags = [],
		narrators = []
	}: {
		filterConfig: FilterConfig;
		statuses: OptionItem[];
		genres: OptionItem[];
		formats: OptionItem[];
		authors: OptionItem[];
		series: OptionItem[];
		tags: OptionItem[];
		narrators: OptionItem[];
	} = $props();

	const FILTERABLE_FIELDS = [
		{ field: 'title', label: 'Title', type: 'text' },
		{ field: 'statusId', label: 'Status', type: 'select', relation: 'statuses' },
		{ field: 'genreId', label: 'Genre', type: 'select', relation: 'genres' },
		{ field: 'formatId', label: 'Format', type: 'select', relation: 'formats' },
		{ field: 'rating', label: 'Rating', type: 'number', min: 0, max: 5 },
		{ field: 'pageCount', label: 'Page Count', type: 'number' },
		{ field: 'publishYear', label: 'Publish Year', type: 'number' },
		{ field: 'authorId', label: 'Author', type: 'select', relation: 'authors' },
		{ field: 'seriesId', label: 'Series', type: 'select', relation: 'series' },
		{ field: 'tagId', label: 'Tag', type: 'select', relation: 'tags' },
		{ field: 'narratorId', label: 'Narrator', type: 'select', relation: 'narrators' },
		{ field: 'completedDate', label: 'Completed Date', type: 'date' },
		{ field: 'startReadingDate', label: 'Start Reading Date', type: 'date' },
		{ field: 'releaseDate', label: 'Release Date', type: 'date' },
		{ field: 'createdAt', label: 'Date Added', type: 'date' },
		{ field: 'ebookPath', label: 'Has Ebook', type: 'boolean' },
		{ field: 'hasAudiobook', label: 'Has Audiobook', type: 'boolean' },
		{ field: 'coverImageUrl', label: 'Has Cover', type: 'boolean' },
		{ field: 'isbn13', label: 'ISBN-13', type: 'text' },
		{ field: 'language', label: 'Language', type: 'text' },
		{ field: 'publisher', label: 'Publisher', type: 'text' }
	] as const;

	const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
		text: [
			{ value: 'equals', label: 'equals' },
			{ value: 'not_equals', label: 'does not equal' },
			{ value: 'contains', label: 'contains' },
			{ value: 'not_contains', label: 'does not contain' },
			{ value: 'is_null', label: 'is empty' },
			{ value: 'is_not_null', label: 'is not empty' }
		],
		number: [
			{ value: 'equals', label: 'equals' },
			{ value: 'not_equals', label: 'does not equal' },
			{ value: 'greater_than', label: 'greater than' },
			{ value: 'less_than', label: 'less than' },
			{ value: 'greater_or_equal', label: 'at least' },
			{ value: 'less_or_equal', label: 'at most' },
			{ value: 'is_null', label: 'is empty' },
			{ value: 'is_not_null', label: 'is not empty' }
		],
		select: [
			{ value: 'equals', label: 'is' },
			{ value: 'not_equals', label: 'is not' },
			{ value: 'in', label: 'is one of' },
			{ value: 'not_in', label: 'is not one of' },
			{ value: 'is_null', label: 'is empty' },
			{ value: 'is_not_null', label: 'is not empty' }
		],
		date: [
			{ value: 'equals', label: 'is' },
			{ value: 'not_equals', label: 'is not' },
			{ value: 'greater_than', label: 'after' },
			{ value: 'less_than', label: 'before' },
			{ value: 'greater_or_equal', label: 'on or after' },
			{ value: 'less_or_equal', label: 'on or before' },
			{ value: 'is_null', label: 'is empty' },
			{ value: 'is_not_null', label: 'is not empty' }
		],
		boolean: [
			{ value: 'is_not_null', label: 'exists' },
			{ value: 'is_null', label: 'does not exist' }
		]
	};

	function getFieldDef(field: string) {
		return FILTERABLE_FIELDS.find(f => f.field === field);
	}

	function getOperatorsForField(field: string) {
		const fieldDef = getFieldDef(field);
		return OPERATORS_BY_TYPE[fieldDef?.type || 'text'] || OPERATORS_BY_TYPE.text;
	}

	function getOptionsForField(field: string): OptionItem[] {
		const fieldDef = getFieldDef(field);
		if (!fieldDef || !('relation' in fieldDef)) return [];

		switch (fieldDef.relation) {
			case 'statuses': return statuses;
			case 'genres': return genres;
			case 'formats': return formats;
			case 'authors': return authors;
			case 'series': return series;
			case 'tags': return tags;
			case 'narrators': return narrators;
			default: return [];
		}
	}

	function isFilterGroup(config: FilterConfig): config is FilterGroup {
		return 'logic' in config && 'rules' in config;
	}

	function addRule(group: FilterGroup) {
		const newRule: FilterRule = {
			field: 'statusId',
			operator: 'equals',
			value: null
		};
		group.rules = [...group.rules, newRule];
		filterConfig = filterConfig; // Trigger reactivity
	}

	function addGroup(parent: FilterGroup) {
		const newGroup: FilterGroup = {
			logic: 'AND',
			rules: [{
				field: 'statusId',
				operator: 'equals',
				value: null
			}]
		};
		parent.rules = [...parent.rules, newGroup];
		filterConfig = filterConfig;
	}

	function removeRule(parent: FilterGroup, index: number) {
		parent.rules = parent.rules.filter((_, i) => i !== index);
		filterConfig = filterConfig;
	}

	function toggleLogic(group: FilterGroup) {
		group.logic = group.logic === 'AND' ? 'OR' : 'AND';
		filterConfig = filterConfig;
	}

	function updateRule(rule: FilterRule, field: keyof FilterRule, value: unknown) {
		if (field === 'field') {
			// Reset operator and value when field changes
			const fieldDef = getFieldDef(value as string);
			const operators = OPERATORS_BY_TYPE[fieldDef?.type || 'text'];
			rule.field = value as string;
			rule.operator = operators[0]?.value || 'equals';
			rule.value = null;
		} else if (field === 'operator') {
			rule.operator = value as FilterOperator;
			// Clear value for null operators
			if (value === 'is_null' || value === 'is_not_null') {
				rule.value = null;
			}
		} else {
			rule.value = value as string | number | null;
		}
		filterConfig = filterConfig;
	}

	// Ensure filterConfig is a valid group
	if (!isFilterGroup(filterConfig)) {
		filterConfig = { logic: 'AND', rules: [filterConfig] };
	}
</script>

<div class="rule-builder">
	{#snippet renderGroup(group: FilterGroup, depth: number = 0)}
		<div
			class="rule-group rounded-lg border p-3"
			style="border-color: var(--border-color); background-color: {depth > 0 ? 'var(--bg-tertiary)' : 'transparent'};"
		>
			<div class="flex items-center gap-2 mb-3">
				<button
					type="button"
					class="px-3 py-1 rounded text-sm font-medium transition-colors"
					style="background-color: var(--accent); color: white;"
					onclick={() => toggleLogic(group)}
				>
					{group.logic}
				</button>
				<span class="text-sm" style="color: var(--text-muted);">Match {group.logic === 'AND' ? 'all' : 'any'} of the following:</span>
			</div>

			<div class="space-y-2">
				{#each group.rules as rule, index (index)}
					<div class="flex items-start gap-2">
						{#if isFilterGroup(rule)}
							<div class="flex-1">
								{@render renderGroup(rule, depth + 1)}
							</div>
						{:else}
							<div class="flex-1 flex flex-wrap items-center gap-2 p-2 rounded-lg" style="background-color: var(--bg-secondary);">
								<!-- Field selector -->
								<select
									class="input-field text-sm py-1 min-w-[140px]"
									value={rule.field}
									onchange={(e) => updateRule(rule, 'field', e.currentTarget.value)}
								>
									{#each FILTERABLE_FIELDS as field}
										<option value={field.field}>{field.label}</option>
									{/each}
								</select>

								<!-- Operator selector -->
								<select
									class="input-field text-sm py-1 min-w-[120px]"
									value={rule.operator}
									onchange={(e) => updateRule(rule, 'operator', e.currentTarget.value)}
								>
									{#each getOperatorsForField(rule.field) as op}
										<option value={op.value}>{op.label}</option>
									{/each}
								</select>

								<!-- Value input (hidden for null operators) -->
								{#if rule.operator !== 'is_null' && rule.operator !== 'is_not_null'}
									{@const fieldDef = getFieldDef(rule.field)}
									{@const options = getOptionsForField(rule.field)}

									{#if fieldDef?.type === 'select' && options.length > 0}
										<select
											class="input-field text-sm py-1 min-w-[160px]"
											value={rule.value ?? ''}
											onchange={(e) => updateRule(rule, 'value', parseInt(e.currentTarget.value))}
										>
											<option value="">Select...</option>
											{#each options as opt}
												<option value={opt.id}>{opt.name}</option>
											{/each}
										</select>
									{:else if fieldDef?.type === 'number'}
										<input
											type="number"
											class="input-field text-sm py-1 w-24"
											placeholder="Value"
											value={rule.value ?? ''}
											onchange={(e) => updateRule(rule, 'value', parseFloat(e.currentTarget.value) || null)}
										/>
									{:else if fieldDef?.type === 'date'}
									<div class="flex items-center gap-2">
										<select
											class="input-field text-sm py-1 min-w-[100px]"
											value={rule.value === '$today' ? '$today' : 'custom'}
											onchange={(e) => {
												if (e.currentTarget.value === '$today') {
													updateRule(rule, 'value', '$today');
												} else {
													updateRule(rule, 'value', null);
												}
											}}
										>
											<option value="$today">Today</option>
											<option value="custom">Specific date</option>
										</select>
										{#if rule.value !== '$today'}
											<input
												type="date"
												class="input-field text-sm py-1"
												value={rule.value ?? ''}
												onchange={(e) => updateRule(rule, 'value', e.currentTarget.value || null)}
											/>
										{/if}
									</div>
									{:else}
										<input
											type="text"
											class="input-field text-sm py-1 flex-1 min-w-[160px]"
											placeholder="Value"
											value={rule.value ?? ''}
											onchange={(e) => updateRule(rule, 'value', e.currentTarget.value || null)}
										/>
									{/if}
								{/if}
							</div>
						{/if}

						<!-- Remove button -->
						<button
							type="button"
							class="p-2 rounded hover:bg-red-500/20 transition-colors"
							style="color: var(--text-muted);"
							onclick={() => removeRule(group, index)}
							title="Remove rule"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				{/each}
			</div>

			<div class="flex gap-2 mt-3">
				<button
					type="button"
					class="btn-ghost text-sm py-1 px-3 flex items-center gap-1"
					onclick={() => addRule(group)}
				>
					<Plus class="w-4 h-4" />
					Add Rule
				</button>
				{#if depth < 2}
					<button
						type="button"
						class="btn-ghost text-sm py-1 px-3 flex items-center gap-1"
						onclick={() => addGroup(group)}
					>
						<Plus class="w-4 h-4" />
						Add Group
					</button>
				{/if}
			</div>
		</div>
	{/snippet}

	{@render renderGroup(filterConfig as FilterGroup)}
</div>

<style>
	.input-field {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 0.375rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
	}

	.input-field:focus {
		outline: none;
		border-color: var(--accent);
	}
</style>
