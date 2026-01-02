import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addToQueue } from '$lib/server/services/bookdropService';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('bookdrop-upload');

// POST /api/bookdrop/upload - Upload ebook files to queue
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const formData = await request.formData();
	const files = formData.getAll('files') as File[];

	if (files.length === 0) {
		throw error(400, 'No files provided');
	}

	// Validate file types
	const allowedExtensions = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.cbr'];
	const results: Array<{ filename: string; success: boolean; error?: string; id?: number }> = [];

	// Ensure temp directory exists
	const tempDir = './static/uploads/temp';
	await mkdir(tempDir, { recursive: true });

	for (const file of files) {
		const ext = path.extname(file.name).toLowerCase();

		if (!allowedExtensions.includes(ext)) {
			log.warn(`Rejected file with unsupported type: ${file.name} (${ext})`);
			results.push({
				filename: file.name,
				success: false,
				error: `Unsupported file type: ${ext}`
			});
			continue;
		}

		try {
			log.info(`Processing upload: ${file.name} (${file.size} bytes)`);

			// Save to temp location
			const buffer = Buffer.from(await file.arrayBuffer());
			const hash = randomBytes(8).toString('hex');
			const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
			const tempPath = path.join(tempDir, `${hash}_${safeName}`);

			log.debug(`Writing to temp path: ${tempPath}`);
			await writeFile(tempPath, buffer);
			log.debug(`File written successfully, adding to queue...`);

			// Add to queue
			const queueItem = await addToQueue(tempPath, file.name, locals.user.id, 'upload');
			log.info(`File added to queue: ${file.name} (queue id: ${queueItem.id})`);

			results.push({
				filename: file.name,
				success: true,
				id: queueItem.id
			});
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Failed to process file';
			log.error(`Upload failed for ${file.name}: ${errorMsg}`, { error: e });
			results.push({
				filename: file.name,
				success: false,
				error: errorMsg
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failedCount = results.filter((r) => !r.success).length;

	return json({
		success: failedCount === 0,
		message: `Uploaded ${successCount} file(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
		results
	});
};
