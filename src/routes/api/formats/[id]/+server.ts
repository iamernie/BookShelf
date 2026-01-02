import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFormatById, updateFormat, deleteFormat, getBooksInFormat } from '$lib/server/services/formatService';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid format ID' });
	}

	const format = await getFormatById(id);
	if (!format) {
		throw error(404, { message: 'Format not found' });
	}

	const books = await getBooksInFormat(id);

	return json({ format, books });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid format ID' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Format name is required' });
	}

	const format = await updateFormat(id, {
		name: data.name.trim(),
		icon: data.icon,
		color: data.color
	});

	if (!format) {
		throw error(404, { message: 'Format not found' });
	}

	return json(format);
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid format ID' });
	}

	// Check for reassignTo in request body
	let reassignToId: number | null | undefined = undefined;
	try {
		const body = await request.json();
		if (body.reassignTo !== undefined) {
			reassignToId = body.reassignTo === null ? null : parseInt(body.reassignTo);
		}
	} catch {
		// No body or invalid JSON - proceed without reassignment
	}

	try {
		// Convert null to undefined for the service function
		const deleted = await deleteFormat(id, reassignToId ?? undefined);
		if (!deleted) {
			throw error(404, { message: 'Format not found' });
		}

		return json({ success: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('Cannot delete format')) {
			throw error(400, { message: err.message });
		}
		if (err instanceof Error && err.message.includes('Target format')) {
			throw error(400, { message: err.message });
		}
		throw err;
	}
};
