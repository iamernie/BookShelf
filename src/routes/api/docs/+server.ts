/**
 * OpenAPI Spec Endpoint
 * Returns the OpenAPI 3.0 specification as JSON
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openApiSpec } from '$lib/server/openapi';

export const GET: RequestHandler = async () => {
	return json(openApiSpec);
};
