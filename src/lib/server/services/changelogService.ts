/**
 * Changelog Parser Service
 * Parses CHANGELOG.md and provides structured data for the What's New modal
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ChangelogItem {
	title: string;
	description?: string;
	subItems?: string[];
}

export interface ChangelogSection {
	title: string;
	items: ChangelogItem[];
}

export interface ChangelogVersion {
	version: string;
	date: string;
	sections: ChangelogSection[];
}

// Cache for parsed changelog
let cachedChangelog: ChangelogVersion[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

// Map section titles to lucide icon names
export function getSectionIcon(sectionTitle: string): string {
	const title = sectionTitle.toLowerCase();

	if (title.includes('bug') || title.includes('fix')) return 'Bug';
	if (title.includes('feature') || title.includes('new') || title.includes('add')) return 'Sparkles';
	if (title.includes('docker')) return 'Container';
	if (title.includes('security')) return 'Shield';
	if (title.includes('performance') || title.includes('improve') || title.includes('enhance')) return 'Rocket';
	if (title.includes('breaking') || title.includes('deprecat')) return 'AlertTriangle';
	if (title.includes('documentation') || title.includes('docs')) return 'BookOpen';
	if (title.includes('repository') || title.includes('code') || title.includes('refactor')) return 'Code';
	if (title.includes('database') || title.includes('schema') || title.includes('migration')) return 'Database';
	if (title.includes('change')) return 'RefreshCw';
	if (title.includes('remove') || title.includes('delet')) return 'Trash2';
	if (title.includes('highlight')) return 'Star';

	return 'CheckCircle';
}

/**
 * Parse the CHANGELOG.md file
 */
function parseChangelog(): ChangelogVersion[] {
	const changelogPath = join(process.cwd(), 'CHANGELOG.md');

	if (!existsSync(changelogPath)) {
		console.warn('CHANGELOG.md not found at', changelogPath);
		return [];
	}

	const content = readFileSync(changelogPath, 'utf-8');
	const lines = content.split('\n');

	const versions: ChangelogVersion[] = [];
	let currentVersion: ChangelogVersion | null = null;
	let currentSection: ChangelogSection | null = null;
	let currentItem: ChangelogItem | null = null;

	for (const line of lines) {
		// Match version headers like "## [2.1.1] - 2025-12-30" or "## [Unreleased]"
		const versionMatch = line.match(/^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/);
		if (versionMatch) {
			// Save previous version
			if (currentVersion) {
				if (currentItem && currentSection) {
					currentSection.items.push(currentItem);
				}
				if (currentSection && currentSection.items.length > 0) {
					currentVersion.sections.push(currentSection);
				}
				if (currentVersion.sections.length > 0) {
					versions.push(currentVersion);
				}
			}

			// Skip unreleased
			if (versionMatch[1].toLowerCase() === 'unreleased') {
				currentVersion = null;
				currentSection = null;
				currentItem = null;
				continue;
			}

			currentVersion = {
				version: versionMatch[1],
				date: versionMatch[2] || '',
				sections: []
			};
			currentSection = null;
			currentItem = null;
			continue;
		}

		// Only process if we're in a version block
		if (!currentVersion) continue;

		// Match section headers like "### Added", "### Fixed"
		const sectionMatch = line.match(/^###\s+(.+)/);
		if (sectionMatch) {
			// Save previous section
			if (currentItem && currentSection) {
				currentSection.items.push(currentItem);
			}
			if (currentSection && currentSection.items.length > 0) {
				currentVersion.sections.push(currentSection);
			}

			currentSection = {
				title: sectionMatch[1].trim(),
				items: []
			};
			currentItem = null;
			continue;
		}

		// Match list items like "- **Feature Title** - Optional description"
		const itemMatch = line.match(/^-\s+\*\*([^*]+)\*\*(?:\s+-\s+(.+))?$/);
		if (itemMatch && currentSection) {
			// Save previous item
			if (currentItem) {
				currentSection.items.push(currentItem);
			}

			currentItem = {
				title: itemMatch[1].trim(),
				description: itemMatch[2]?.trim(),
				subItems: []
			};
			continue;
		}

		// Match simpler list items without bold (just "- text")
		const simpleItemMatch = line.match(/^-\s+(?!\*\*)(.+)$/);
		if (simpleItemMatch && currentSection && !line.startsWith('  -')) {
			// Save previous item
			if (currentItem) {
				currentSection.items.push(currentItem);
			}

			currentItem = {
				title: simpleItemMatch[1].trim(),
				subItems: []
			};
			continue;
		}

		// Match sub-items like "  - Sub-item text"
		const subItemMatch = line.match(/^\s{2,}-\s+(.+)/);
		if (subItemMatch && currentItem) {
			if (!currentItem.subItems) {
				currentItem.subItems = [];
			}
			currentItem.subItems.push(subItemMatch[1].trim());
			continue;
		}
	}

	// Save final state
	if (currentVersion) {
		if (currentItem && currentSection) {
			currentSection.items.push(currentItem);
		}
		if (currentSection && currentSection.items.length > 0) {
			currentVersion.sections.push(currentSection);
		}
		if (currentVersion.sections.length > 0) {
			versions.push(currentVersion);
		}
	}

	return versions;
}

/**
 * Get all parsed changelog versions (with caching)
 */
export function getAllVersions(): ChangelogVersion[] {
	const now = Date.now();

	if (cachedChangelog && (now - lastCacheTime) < CACHE_TTL) {
		return cachedChangelog;
	}

	cachedChangelog = parseChangelog();
	lastCacheTime = now;

	return cachedChangelog;
}

/**
 * Get the latest version info
 */
export function getLatestVersion(): ChangelogVersion | null {
	const versions = getAllVersions();
	return versions.length > 0 ? versions[0] : null;
}

/**
 * Get a specific version
 */
export function getVersion(version: string): ChangelogVersion | null {
	const versions = getAllVersions();
	return versions.find(v => v.version === version) || null;
}

/**
 * Clear the changelog cache (useful when CHANGELOG.md is updated)
 */
export function clearCache(): void {
	cachedChangelog = null;
	lastCacheTime = 0;
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
	if (!dateStr) return '';

	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	} catch {
		return dateStr;
	}
}
