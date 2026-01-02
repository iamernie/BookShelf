import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { env } from '$env/dynamic/private';
import { getAudiobookById, updateAudiobook } from '$lib/server/services/audiobookService';

function getAudiobooksBasePath(): string {
	const dataPath = env.DATA_PATH || './data';
	return join(dataPath, 'audiobooks');
}

function getAudiobookPath(userId: number, audiobookId: number): string {
	return join(getAudiobooksBasePath(), String(userId), String(audiobookId));
}

async function ensureAudiobookDir(userId: number, audiobookId: number): Promise<string> {
	const dir = getAudiobookPath(userId, audiobookId);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

// POST /api/audiobooks/[id]/cover - Upload cover image
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check ownership
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	try {
		const formData = await request.formData();
		const coverFile = formData.get('cover') as File | null;

		if (!coverFile || !(coverFile instanceof File)) {
			throw error(400, 'No cover file provided');
		}

		// Validate file type
		const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!validTypes.includes(coverFile.type)) {
			throw error(400, 'Invalid image type. Supported: JPEG, PNG, GIF, WebP');
		}

		// Get extension from mime type
		const extMap: Record<string, string> = {
			'image/jpeg': '.jpg',
			'image/png': '.png',
			'image/gif': '.gif',
			'image/webp': '.webp'
		};
		const ext = extMap[coverFile.type] || '.jpg';

		// Save cover file
		const dir = await ensureAudiobookDir(user.id, audiobookId);
		const coverFilename = `cover${ext}`;
		const coverPath = join(dir, coverFilename);

		const arrayBuffer = await coverFile.arrayBuffer();
		await writeFile(coverPath, Buffer.from(arrayBuffer));

		// Update audiobook record with cover path
		// Store as relative path for serving
		const relativeCoverPath = `/api/audiobooks/${audiobookId}/cover`;
		await updateAudiobook(audiobookId, { coverPath: relativeCoverPath });

		return json({
			success: true,
			coverPath: relativeCoverPath
		});
	} catch (e) {
		console.error('[api/audiobooks/cover] Failed to upload cover:', e);
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		throw error(500, 'Failed to upload cover');
	}
};

// GET /api/audiobooks/[id]/cover - Serve cover image
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	if (isNaN(audiobookId)) {
		throw error(400, 'Invalid audiobook ID');
	}

	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check ownership
	if (audiobook.userId !== user.id) {
		throw error(403, 'Access denied');
	}

	// Find cover file in audiobook directory
	const dir = getAudiobookPath(user.id, audiobookId);
	const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

	let coverPath: string | null = null;
	let mimeType = 'image/jpeg';

	for (const ext of extensions) {
		const testPath = join(dir, `cover${ext}`);
		if (existsSync(testPath)) {
			coverPath = testPath;
			mimeType = ext === '.png' ? 'image/png'
				: ext === '.gif' ? 'image/gif'
				: ext === '.webp' ? 'image/webp'
				: 'image/jpeg';
			break;
		}
	}

	if (!coverPath) {
		throw error(404, 'Cover not found');
	}

	const { readFile } = await import('fs/promises');
	const coverData = await readFile(coverPath);

	return new Response(coverData, {
		headers: {
			'Content-Type': mimeType,
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
