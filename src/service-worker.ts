/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets to cache immediately on install
const ASSETS = [
	...build, // the app itself (JS/CSS bundles)
	...files  // static files (icons, fonts, etc.)
];

// Install event - cache all static assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => {
			return cache.addAll(ASSETS);
		}).then(() => {
			// Activate immediately
			return sw.skipWaiting();
		})
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys
					.filter((key) => key !== CACHE)
					.map((key) => caches.delete(key))
			);
		}).then(() => {
			// Take control of all pages immediately
			return sw.clients.claim();
		})
	);
});

// Fetch event - serve from cache, fall back to network
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests
	if (url.origin !== location.origin) return;

	// Skip API requests - always fetch fresh
	if (url.pathname.startsWith('/api/')) return;

	// Skip auth-related pages - always fetch fresh
	if (url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/signup') ||
		url.pathname.startsWith('/logout')) return;

	event.respondWith(
		caches.open(CACHE).then((cache) => {
			return cache.match(event.request).then((cachedResponse) => {
				// For static assets, serve from cache first
				if (cachedResponse && ASSETS.includes(url.pathname)) {
					return cachedResponse;
				}

				// For navigation requests, try network first, fall back to cache
				return fetch(event.request)
					.then((response) => {
						// Cache successful responses for static assets
						if (response.ok && (
							url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/) ||
							ASSETS.includes(url.pathname)
						)) {
							cache.put(event.request, response.clone());
						}
						return response;
					})
					.catch(() => {
						// If network fails and we have a cached version, use it
						if (cachedResponse) {
							return cachedResponse;
						}
						// For HTML pages, return the offline page or a basic error
						if (event.request.headers.get('accept')?.includes('text/html')) {
							return new Response(
								'<html><body><h1>Offline</h1><p>You are currently offline. Please check your connection.</p></body></html>',
								{ headers: { 'Content-Type': 'text/html' } }
							);
						}
						throw new Error('Network unavailable');
					});
			});
		})
	);
});
