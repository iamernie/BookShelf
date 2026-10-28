/**
 * Widget HTML renderer (server-only). Self-contained markup and styles so the
 * output can be dropped into an iframe on any site.
 */

import { currentYearInAppTz } from '$lib/server/utils/appTime';
import type {
	WidgetBook,
	WidgetData,
	WidgetGoal,
	WidgetStats,
	WidgetTheme,
	WidgetType
} from '$lib/server/services/widgetService';

export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function renderWidget(type: WidgetType, theme: WidgetTheme, data: WidgetData): string {
	const isDark = theme === 'dark';

	const colors = isDark
		? {
				bg: '#1a1a2e',
				cardBg: '#16213e',
				text: '#eaeaea',
				textMuted: '#a0a0a0',
				accent: '#4a90d9',
				border: '#2d3748'
			}
		: {
				bg: '#f8f9fa',
				cardBg: '#ffffff',
				text: '#1a1a1a',
				textMuted: '#6b7280',
				accent: '#2563eb',
				border: '#e5e7eb'
			};

	const baseStyles = `
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: ${colors.bg};
			color: ${colors.text};
			padding: 16px;
			min-height: 100vh;
		}
		.widget {
			background: ${colors.cardBg};
			border-radius: 12px;
			padding: 16px;
			border: 1px solid ${colors.border};
		}
		.widget-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 16px;
			padding-bottom: 12px;
			border-bottom: 1px solid ${colors.border};
		}
		.widget-title {
			font-size: 14px;
			font-weight: 600;
			color: ${colors.text};
		}
		.widget-icon {
			width: 20px;
			height: 20px;
			color: ${colors.accent};
		}
		.book-list {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
		.book-item {
			display: flex;
			gap: 12px;
			align-items: flex-start;
		}
		.book-cover {
			width: 40px;
			height: 60px;
			border-radius: 4px;
			object-fit: cover;
			background: ${colors.border};
			flex-shrink: 0;
		}
		.book-info {
			flex: 1;
			min-width: 0;
		}
		.book-title {
			font-size: 13px;
			font-weight: 500;
			color: ${colors.text};
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.book-author {
			font-size: 12px;
			color: ${colors.textMuted};
			margin-top: 2px;
		}
		.book-series {
			font-size: 11px;
			color: ${colors.accent};
			margin-top: 2px;
		}
		.book-rating {
			font-size: 11px;
			color: #fbbf24;
			margin-top: 2px;
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}
		.stat-item {
			text-align: center;
			padding: 12px 8px;
			background: ${colors.bg};
			border-radius: 8px;
		}
		.stat-value {
			font-size: 20px;
			font-weight: 700;
			color: ${colors.accent};
		}
		.stat-label {
			font-size: 11px;
			color: ${colors.textMuted};
			margin-top: 4px;
		}
		.goal-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 16px;
		}
		.goal-ring {
			position: relative;
			width: 120px;
			height: 120px;
		}
		.goal-ring svg {
			transform: rotate(-90deg);
		}
		.goal-ring-bg {
			fill: none;
			stroke: ${colors.border};
			stroke-width: 8;
		}
		.goal-ring-progress {
			fill: none;
			stroke: ${colors.accent};
			stroke-width: 8;
			stroke-linecap: round;
			transition: stroke-dashoffset 0.5s ease;
		}
		.goal-percent {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 24px;
			font-weight: 700;
			color: ${colors.text};
		}
		.goal-details {
			text-align: center;
		}
		.goal-current {
			font-size: 14px;
			color: ${colors.text};
		}
		.goal-remaining {
			font-size: 12px;
			color: ${colors.textMuted};
			margin-top: 4px;
		}
		.book-release {
			font-size: 11px;
			color: ${colors.textMuted};
			margin-top: 2px;
		}
		.empty-state {
			text-align: center;
			padding: 24px;
			color: ${colors.textMuted};
			font-size: 13px;
		}
	`;

	let content = '';
	let title = '';
	let icon = '';

	switch (type) {
		case 'currently-reading':
			title = 'Currently Reading';
			icon = bookIcon;
			content = renderBookList(data.books || []);
			break;
		case 'recent-reads':
			title = 'Recent Reads';
			icon = checkIcon;
			content = renderBookList(data.books || [], { showRating: true });
			break;
		case 'stats':
			title = 'Reading Stats';
			icon = chartIcon;
			content = data.stats ? renderStats(data.stats) : '<div class="empty-state">No stats available</div>';
			break;
		case 'goal':
			title = `${data.goal?.year ?? currentYearInAppTz()} Reading Goal`;
			icon = targetIcon;
			content = renderGoal(data.goal ?? null);
			break;
		case 'next-up':
			title = 'Next Up';
			icon = listIcon;
			content = renderBookList(data.books || []);
			break;
		case 'upcoming-releases':
			title = 'Upcoming Releases';
			icon = calendarIcon;
			content = renderBookList(data.books || [], { showReleaseDate: true });
			break;
	}

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(title)} - BookShelf Widget</title>
	<style>${baseStyles}</style>
</head>
<body>
	<div class="widget">
		<div class="widget-header">
			<span class="widget-icon">${icon}</span>
			<span class="widget-title">${escapeHtml(title)}</span>
		</div>
		${content}
	</div>
</body>
</html>`;
}

function renderBookList(
	books: WidgetBook[],
	{ showRating = false, showReleaseDate = false }: { showRating?: boolean; showReleaseDate?: boolean } = {}
): string {
	if (books.length === 0) {
		return '<div class="empty-state">No books to display</div>';
	}

	return `<div class="book-list">
		${books
			.map(
				(book) => `
			<div class="book-item">
				<img class="book-cover" src="${escapeHtml(book.coverUrl || '/placeholder.png')}" alt="" onerror="this.src='/placeholder.png'">
				<div class="book-info">
					<div class="book-title">${escapeHtml(book.title)}</div>
					${book.author ? `<div class="book-author">${escapeHtml(book.author)}</div>` : ''}
					${book.series ? `<div class="book-series">${escapeHtml(book.series)}${book.bookNum ? ` #${book.bookNum}` : ''}</div>` : ''}
					${showReleaseDate && book.releaseDate ? `<div class="book-release">${escapeHtml(book.releaseDate)}</div>` : ''}
					${showRating && book.rating ? `<div class="book-rating">${'★'.repeat(Math.round(book.rating))}${'☆'.repeat(5 - Math.round(book.rating))}</div>` : ''}
				</div>
			</div>
		`
			)
			.join('')}
	</div>`;
}

function renderStats(stats: WidgetStats): string {
	return `<div class="stats-grid">
		<div class="stat-item">
			<div class="stat-value">${stats.totalBooks}</div>
			<div class="stat-label">Total Books</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">${stats.booksRead}</div>
			<div class="stat-label">Books Read</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">${stats.booksThisYear}</div>
			<div class="stat-label">This Year</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">${stats.avgRating || '-'}</div>
			<div class="stat-label">Avg Rating</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">${stats.totalAuthors}</div>
			<div class="stat-label">Authors</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">${stats.completionPercent}%</div>
			<div class="stat-label">Completed</div>
		</div>
	</div>`;
}

function renderGoal(goal: WidgetGoal | null): string {
	if (!goal) {
		return '<div class="empty-state">No reading goal set for this year</div>';
	}

	const circumference = 2 * Math.PI * 52;
	const offset = circumference - (goal.percent / 100) * circumference;

	return `<div class="goal-container">
		<div class="goal-ring">
			<svg width="120" height="120">
				<circle class="goal-ring-bg" cx="60" cy="60" r="52" />
				<circle class="goal-ring-progress" cx="60" cy="60" r="52"
					stroke-dasharray="${circumference}"
					stroke-dashoffset="${offset}" />
			</svg>
			<div class="goal-percent">${goal.percent}%</div>
		</div>
		<div class="goal-details">
			<div class="goal-current">${goal.current} of ${goal.target} books</div>
			<div class="goal-remaining">${goal.remaining} books remaining</div>
		</div>
	</div>`;
}

// SVG Icons (inline for iframe isolation)
const bookIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;

const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

const targetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;

const listIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
