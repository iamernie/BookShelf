<script lang="ts">
	import { Star, Check } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	interface Status {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	let {
		bookId,
		currentRating = null,
		currentStatusId = null,
		statuses = [],
		onRatingChange,
		onStatusChange,
		onClose
	}: {
		bookId: number;
		currentRating?: number | null;
		currentStatusId?: number | null;
		statuses: Status[];
		onRatingChange: (bookId: number, rating: number) => Promise<void>;
		onStatusChange: (bookId: number, statusId: number) => Promise<void>;
		onClose: () => void;
	} = $props();

	let saving = $state(false);
	let hoverRating = $state<number | null>(null);

	async function handleRating(rating: number) {
		if (saving) return;
		saving = true;
		try {
			await onRatingChange(bookId, rating);
		} finally {
			saving = false;
		}
	}

	async function handleStatus(statusId: number) {
		if (saving || statusId === currentStatusId) return;
		saving = true;
		try {
			await onStatusChange(bookId, statusId);
		} finally {
			saving = false;
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		e.stopPropagation();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<div
	class="absolute inset-0 bg-black/80 flex flex-col justify-center items-center p-2 z-10 rounded-t-lg"
	onclick={handleOverlayClick}
	onkeydown={handleKeydown}
	role="dialog"
	aria-label="Quick edit book"
	tabindex="-1"
>
	<!-- Star Rating -->
	<div class="flex items-center gap-0.5 mb-3">
		{#each [1, 2, 3, 4, 5] as star}
			<button
				type="button"
				class="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
				disabled={saving}
				onclick={() => handleRating(star)}
				onmouseenter={() => hoverRating = star}
				onmouseleave={() => hoverRating = null}
				title="Rate {star} star{star > 1 ? 's' : ''}"
			>
				<Star
					class="w-5 h-5 transition-colors {(hoverRating !== null ? star <= hoverRating : star <= (currentRating || 0)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}"
				/>
			</button>
		{/each}
		{#if currentRating}
			<span class="text-white text-xs ml-1">{currentRating.toFixed(1)}</span>
		{/if}
	</div>

	<!-- Status Buttons -->
	<div class="flex flex-wrap justify-center gap-1 max-w-full">
		{#each statuses.slice(0, 6) as status}
			<button
				type="button"
				class="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all disabled:opacity-50"
				style="background-color: {status.id === currentStatusId ? status.color || '#6c757d' : 'rgba(255,255,255,0.1)'}; color: {status.id === currentStatusId ? 'white' : '#ccc'};"
				disabled={saving}
				onclick={() => handleStatus(status.id)}
				title={status.name}
			>
				{#if status.icon}
					<DynamicIcon icon={status.icon} size={10} />
				{/if}
				<span class="truncate max-w-[60px]">{status.name}</span>
				{#if status.id === currentStatusId}
					<Check class="w-3 h-3" />
				{/if}
			</button>
		{/each}
	</div>

	<!-- Close hint -->
	<p class="text-gray-400 text-[9px] mt-2">Click outside to close</p>
</div>
