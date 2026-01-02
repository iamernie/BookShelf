import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReadStream, statSync, existsSync } from 'fs';
import { Readable } from 'stream';
import {
	getAudiobookById,
	getAudiobookFileById,
	isAudiobookInUserLibrary
} from '$lib/server/services/audiobookService';

// GET /api/audiobooks/[id]/stream/[fileId] - Stream audio file
export const GET: RequestHandler = async ({ locals, params, request }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const audiobookId = parseInt(params.id);
	const fileId = parseInt(params.fileId);

	if (isNaN(audiobookId) || isNaN(fileId)) {
		throw error(400, 'Invalid ID');
	}

	// Get audiobook and verify access
	const audiobook = await getAudiobookById(audiobookId);
	if (!audiobook) {
		throw error(404, 'Audiobook not found');
	}

	// Check access: user owns it, OR it's public, OR user has it in their library
	const hasAccess =
		audiobook.userId === user.id ||
		audiobook.libraryType === 'public' ||
		(await isAudiobookInUserLibrary(user.id, audiobookId));

	if (!hasAccess) {
		throw error(403, 'Access denied');
	}

	// Get file
	const file = await getAudiobookFileById(fileId);
	if (!file || file.audiobookId !== audiobookId) {
		throw error(404, 'File not found');
	}

	// Check file exists
	if (!existsSync(file.filePath)) {
		console.error(`[stream] File not found on disk: ${file.filePath}`);
		throw error(404, 'File not found on disk');
	}

	const stat = statSync(file.filePath);
	const fileSize = stat.size;
	const mimeType = file.mimeType || 'audio/mpeg';

	// Handle range requests for seeking
	const rangeHeader = request.headers.get('range');

	if (rangeHeader) {
		// Parse range header
		const parts = rangeHeader.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

		if (start >= fileSize || end >= fileSize) {
			throw error(416, 'Requested range not satisfiable');
		}

		const chunkSize = end - start + 1;
		const stream = createReadStream(file.filePath, { start, end });

		// Convert Node stream to Web ReadableStream
		const webStream = Readable.toWeb(stream) as ReadableStream;

		return new Response(webStream, {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': String(chunkSize),
				'Content-Type': mimeType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	}

	// No range request - serve entire file
	const stream = createReadStream(file.filePath);
	const webStream = Readable.toWeb(stream) as ReadableStream;

	return new Response(webStream, {
		status: 200,
		headers: {
			'Content-Length': String(fileSize),
			'Content-Type': mimeType,
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
