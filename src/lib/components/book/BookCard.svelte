<script lang="ts">
	import { BookOpen, Star, Edit3, Info, BookOpenCheck, MoreVertical, Headphones } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import QuickEditOverlay from './QuickEditOverlay.svelte';
	import BookCardMenu from './BookCardMenu.svelte';
	import type { BookCardData } from '$lib/types';

	interface Status {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	let {
		book,
		selected = false,
		selectable = false,
		showStatus = true,
		showTags = true,
		showAuthor = true,
		showSeries = true,
		showFormat = true,
		quickEdit = false,
		showHoverActions = true,
		statuses = [],
		onSelect,
		onClick,
		onQuickEdit,
		onViewDetails,
		onEdit,
		onDownload,
		onDelete,
		onAssignShelf
	}: {
		book: BookCardData;
		selected?: boolean;
		selectable?: boolean;
		showStatus?: boolean;
		showTags?: boolean;
		showAuthor?: boolean;
		showSeries?: boolean;
		showFormat?: boolean;
		quickEdit?: boolean;
		showHoverActions?: boolean;
		statuses?: Status[];
		onSelect?: (id: number) => void;
		onClick?: (book: BookCardData) => void;
		onQuickEdit?: (bookId: number, field: string, value: any) => Promise<void>;
		onViewDetails?: (book: BookCardData) => void;
		onEdit?: (book: BookCardData) => void;
		onDownload?: (book: BookCardData) => void;
		onDelete?: (book: BookCardData) => void;
		onAssignShelf?: (book: BookCardData) => void;
	} = $props();

	let showQuickEditOverlay = $state(false);
	let isHovered = $state(false);
	let showStatusDropdown = $state(false);
	let statusBarRef = $state<HTMLElement | null>(null);
	let dropdownPosition = $state({ top: 0, left: 0, width: 0 });

	function handleClick(e: MouseEvent) {
		if (showQuickEditOverlay || showStatusDropdown) return;
		if (selectable && (e.target as HTMLElement).closest('input[type=checkbox]')) {
			return;
		}
		if ((e.target as HTMLElement).closest('.quick-edit-btn') || (e.target as HTMLElement).closest('.hover-action-btn') || (e.target as HTMLElement).closest('.book-card-menu') || (e.target as HTMLElement).closest('.status-bar-wrapper') || (e.target as HTMLElement).closest('.format-badge')) {
			return;
		}
		onClick?.(book);
	}

	function handleCheckbox(e: Event) {
		e.stopPropagation();
		onSelect?.(book.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((showQuickEditOverlay || showStatusDropdown) && e.key === 'Escape') {
			showQuickEditOverlay = false;
			showStatusDropdown = false;
			return;
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onClick?.(book);
		}
	}

	function handleQuickEditClick(e?: MouseEvent) {
		e?.stopPropagation();
		showQuickEditOverlay = true;
	}

	async function handleRatingChange(bookId: number, rating: number) {
		if (onQuickEdit) {
			await onQuickEdit(bookId, 'rating', rating);
		}
	}

	async function handleStatusChange(bookId: number, statusId: number) {
		if (onQuickEdit) {
			await onQuickEdit(bookId, 'statusId', statusId);
		}
	}

	function handleStatusBarClick(e: MouseEvent) {
		e.stopPropagation();
		if (onQuickEdit && statuses.length > 0) {
			if (!showStatusDropdown && statusBarRef) {
				const rect = statusBarRef.getBoundingClientRect();
				// Use viewport coordinates for fixed positioning
				dropdownPosition = {
					top: rect.bottom,
					left: rect.left,
					width: rect.width
				};
			}
			showStatusDropdown = !showStatusDropdown;
		}
	}

	async function handleStatusSelect(statusId: number) {
		showStatusDropdown = false;
		if (onQuickEdit) {
			await onQuickEdit(book.id, 'statusId', statusId);
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (showStatusDropdown && statusBarRef && !statusBarRef.contains(e.target as Node)) {
			showStatusDropdown = false;
		}
	}

	// Map simple icon names to Font Awesome classes
	function getTagIconClass(icon: string | null): string {
		if (!icon) return 'fas fa-tag';
		if (icon.startsWith('fas ') || icon.startsWith('far ') || icon.startsWith('fab ')) {
			return icon;
		}
		const iconMap: Record<string, string> = {
			heart: 'fas fa-heart',
			star: 'fas fa-star',
			tag: 'fas fa-tag',
			bookmark: 'fas fa-bookmark'
		};
		return iconMap[icon] || 'fas fa-tag';
	}

	// Get first 4 tags for display (to show more tags without cluttering)
	let displayTags = $derived((book.tags || []).slice(0, 4));

	// Hover action handlers
	function handleReadClick(e: MouseEvent) {
		e.stopPropagation();
		if (book.ebookPath) {
			window.location.href = `/reader/${book.id}`;
		}
	}

	function handleListenClick(e: MouseEvent) {
		e.stopPropagation();
		if (book.audiobookId) {
			window.location.href = `/audiobooks/${book.audiobookId}`;
		}
	}

	function handleInfoClick(e: MouseEvent) {
		e.stopPropagation();
		if (onViewDetails) {
			onViewDetails(book);
		} else {
			window.location.href = `/books/${book.id}`;
		}
	}

	function handleEditAction() {
		if (onEdit) {
			onEdit(book);
		} else {
			window.location.href = `/books/${book.id}/edit`;
		}
	}

	function handleDownloadAction() {
		onDownload?.(book);
	}

	function handleDeleteAction() {
		onDelete?.(book);
	}

	function handleAssignShelfAction() {
		onAssignShelf?.(book);
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div
	class="card group cursor-pointer hover:shadow-lg transition-all duration-200 max-w-[180px]"
	style="{selected ? 'ring: 2px solid var(--accent);' : ''}"
	onclick={handleClick}
	onkeydown={handleKeydown}
	onmouseenter={() => isHovered = true}
	onmouseleave={() => isHovered = false}
	role="button"
	tabindex="0"
>
	<!-- Cover Image -->
	<div class="relative aspect-[2/3] overflow-hidden" style="background-color: var(--bg-tertiary);">
		<img
			src={book.coverImageUrl || '/placeholder.png'}
			alt={book.title}
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
			loading="lazy"
			onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
		/>

		<!-- Quick Edit Overlay -->
		{#if showQuickEditOverlay && quickEdit}
			<QuickEditOverlay
				bookId={book.id}
				currentRating={book.rating}
				currentStatusId={book.status?.id}
				{statuses}
				onRatingChange={handleRatingChange}
				onStatusChange={handleStatusChange}
				onClose={() => showQuickEditOverlay = false}
			/>
		{/if}

		<!-- Hover Action Overlay -->
		{#if showHoverActions && !showQuickEditOverlay}
			<div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center pointer-events-none">
				<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
					<!-- Read Button (if ebook exists) -->
					{#if book.ebookPath}
						<button
							type="button"
							class="hover-action-btn p-2.5 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 transition-all shadow-lg"
							onclick={handleReadClick}
							title="Read book"
						>
							<BookOpenCheck class="w-5 h-5" />
						</button>
					{/if}

					<!-- Listen Button (if audiobook exists) -->
					{#if book.audiobookId}
						<button
							type="button"
							class="hover-action-btn p-2.5 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 transition-all shadow-lg"
							onclick={handleListenClick}
							title="Listen to audiobook"
						>
							<Headphones class="w-5 h-5" />
						</button>
					{/if}

					<!-- Info Button -->
					<button
						type="button"
						class="hover-action-btn p-2.5 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 transition-all shadow-lg"
						onclick={handleInfoClick}
						title="View details"
					>
						<Info class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Menu Button (top right) -->
			<div class="book-card-menu absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<BookCardMenu
					bookId={book.id}
					hasEbook={!!book.ebookPath}
					onViewDetails={() => { window.location.href = `/books/${book.id}`; }}
					onEdit={handleEditAction}
					onQuickEdit={quickEdit ? () => handleQuickEditClick() : undefined}
					onDownload={book.ebookPath ? handleDownloadAction : undefined}
					onDelete={onDelete ? handleDeleteAction : undefined}
					onAssignShelf={onAssignShelf ? handleAssignShelfAction : undefined}
				/>
			</div>
		{:else if quickEdit && !showQuickEditOverlay}
			<!-- Quick Edit Button (fallback when hover actions disabled) -->
			<button
				type="button"
				class="quick-edit-btn absolute top-1 right-1 p-1.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
				onclick={handleQuickEditClick}
				title="Quick edit"
			>
				<Edit3 class="w-3.5 h-3.5" />
			</button>
		{/if}

		<!-- Selection Checkbox -->
		{#if selectable}
			<div class="absolute top-2 left-2">
				<input
					type="checkbox"
					checked={selected}
					onchange={handleCheckbox}
					class="w-5 h-5 rounded"
					style="accent-color: var(--accent);"
				/>
			</div>
		{/if}

		<!-- Rating Badge (move to bottom when quick edit is enabled to avoid overlap) -->
		{#if book.rating && !quickEdit}
			<div class="absolute top-1 right-1 bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 text-xs">
				<Star class="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
				{book.rating.toFixed(1)}
			</div>
		{/if}

		<!-- Series Number Badge (hidden when selectable to avoid checkbox overlap) -->
		{#if !selectable && book.seriesName && book.bookNum}
			<div class="absolute top-1 left-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
				#{book.bookNum}
			</div>
		{/if}

		<!-- Media Format Badges (eBook/Audiobook) - Always visible, tappable -->
		{#if book.ebookPath || book.audiobookId}
			<div class="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1.5 justify-start format-badges">
				{#if book.ebookPath}
					<button
						type="button"
						class="format-badge flex items-center gap-1 px-2 py-1 rounded-md text-white text-[11px] font-medium shadow-md hover:scale-105 active:scale-95 transition-transform"
						style="background-color: #3b82f6;"
						onclick={handleReadClick}
						title="Read eBook"
					>
						<BookOpen class="w-3.5 h-3.5" />
						<span class="hidden sm:inline">Read</span>
					</button>
				{/if}
				{#if book.audiobookId}
					<button
						type="button"
						class="format-badge flex items-center gap-1 px-2 py-1 rounded-md text-white text-[11px] font-medium shadow-md hover:scale-105 active:scale-95 transition-transform"
						style="background-color: #8b5cf6;"
						onclick={handleListenClick}
						title="Listen to Audiobook"
					>
						<Headphones class="w-3.5 h-3.5" />
						<span class="hidden sm:inline">Listen</span>
					</button>
				{/if}
			</div>
		{/if}

	</div>

	<!-- Status Bar (full-width, above title) -->
	{#if showStatus && book.status}
		<div class="status-bar-wrapper" bind:this={statusBarRef}>
			<button
				type="button"
				class="status-bar w-full py-1 text-center text-white font-semibold text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 shadow-sm transition-all {onQuickEdit && statuses.length > 0 ? 'hover:brightness-110 cursor-pointer' : 'cursor-default'}"
				style="background-color: {book.status.color || '#6c757d'}"
				onclick={handleStatusBarClick}
				title={onQuickEdit && statuses.length > 0 ? 'Click to change status' : book.status.name}
			>
				{#if book.status.icon}
					<DynamicIcon icon={book.status.icon} size={10} />
				{/if}
				{book.status.name}
			</button>
		</div>
	{/if}

	<!-- Book Info -->
	<div class="px-2 py-1.5">
		<h3 class="font-medium text-xs line-clamp-2 leading-tight transition-colors" style="color: var(--text-primary);">
			{book.title}
		</h3>
		{#if showAuthor && book.authorName}
			<p class="text-[10px] mt-0.5 truncate" style="color: var(--text-secondary);">{book.authorName}</p>
		{/if}
		{#if showSeries && book.seriesName}
			<p class="text-[10px] truncate" style="color: var(--text-muted);">
				{book.seriesName}
				{#if book.bookNum}
					#{book.bookNum}
				{/if}
			</p>
		{/if}
		{#if showTags && displayTags.length > 0}
			<div class="flex flex-wrap gap-1 mt-1">
				{#each displayTags as tag}
					<a
						href="/books?tag={tag.id}"
						class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all hover:brightness-110"
						style="background-color: {tag.color || '#6c757d'}20; color: {tag.color || '#6c757d'}"
						title={tag.name}
						onclick={(e) => e.stopPropagation()}
					>
						<DynamicIcon icon={getTagIconClass(tag.icon)} size={8} />
						{tag.name}
					</a>
				{/each}
				{#if (book.tags?.length || 0) > 4}
					<span class="text-[9px]" style="color: var(--text-muted);">+{(book.tags?.length || 0) - 4}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Status Dropdown Portal (rendered outside card to avoid overflow clipping) -->
{#if showStatusDropdown && showStatus && book.status}
	<div
		class="fixed z-[9999] shadow-lg rounded overflow-hidden"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
	>
		{#each statuses as status}
			<button
				type="button"
				class="w-full px-2 py-1.5 text-left text-[10px] font-medium flex items-center gap-1.5 transition-colors"
				style="background-color: {status.id === book.status?.id ? (status.color || '#6c757d') : 'var(--bg-secondary)'}; color: {status.id === book.status?.id ? 'white' : 'var(--text-primary)'}"
				onmouseenter={(e) => { if (status.id !== book.status?.id) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)'; }}
				onmouseleave={(e) => { if (status.id !== book.status?.id) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-secondary)'; }}
				onclick={(e) => { e.stopPropagation(); handleStatusSelect(status.id); }}
			>
				<span
					class="w-2 h-2 rounded-full flex-shrink-0"
					style="background-color: {status.color || '#6c757d'}"
				></span>
				{#if status.icon}
					<DynamicIcon icon={status.icon} size={10} />
				{/if}
				{status.name}
			</button>
		{/each}
	</div>
{/if}
