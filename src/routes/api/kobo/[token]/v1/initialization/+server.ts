/**
 * Kobo Initialization API
 *
 * GET /api/kobo/[token]/v1/initialization
 *
 * Returns the Kobo resources configuration that tells the device
 * where to find various API endpoints.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateToken } from '$lib/server/services/koboService';

// Default Kobo resources template
// These URLs will be rewritten to point to our server
function generateResources(baseUrl: string, token: string) {
	const koboBase = `${baseUrl}/api/kobo/${token}`;

	return {
		// Image URLs - point to our server for local books
		image_host: baseUrl,
		image_url_template: `${koboBase}/v1/books/{ImageId}/thumbnail/{Width}/{Height}/false/image.jpg`,
		image_url_quality_template: `${koboBase}/v1/books/{ImageId}/thumbnail/{Width}/{Height}/{Quality}/{IsGreyscale}/image.jpg`,

		// Other Kobo URLs that we'll proxy
		// These are used by the device for store access
		affiliate: 'https://storeapi.kobo.com/v1/affiliate',
		audiobook_landing_page: 'https://store.kobobooks.com/audiobooks',
		authentication_host: `${koboBase}`,
		book: 'https://storeapi.kobo.com/v1/products/books/{ProductId}',
		book_detail: 'https://store.kobobooks.com/{culture}/ebook/{slug}',
		book_landing_page: 'https://store.kobobooks.com/ebooks',
		book_subscription: 'https://storeapi.kobo.com/v1/products/books/subscriptions/{SubscriptionId}',
		categories: 'https://storeapi.kobo.com/v1/categories',
		categories_page: 'https://store.kobobooks.com/ebooks/categories',
		category: 'https://storeapi.kobo.com/v1/categories/{CategoryId}',
		category_featured_lists: 'https://storeapi.kobo.com/v1/categories/{CategoryId}/featured',
		category_products: 'https://storeapi.kobo.com/v1/categories/{CategoryId}/products',
		checkout_host: 'https://secure.kobobooks.com',
		configuration_data: 'https://storeapi.kobo.com/v1/configuration',
		content_access_book: `${koboBase}/v1/products/books/{ProductId}/access`,
		deals: 'https://storeapi.kobo.com/v1/deals',
		deals_page: 'https://store.kobobooks.com/ebooks/deals',
		device_auth: `${koboBase}/v1/auth/device`,
		device_refresh: `${koboBase}/v1/auth/refresh`,
		dictionary_host: 'https://kbdownload1-a.akamaihd.net',
		external_book: 'https://storeapi.kobo.com/v1/products/books/external/{Ids}',
		featured_list: 'https://storeapi.kobo.com/v1/products/featured/{FeaturedListId}',
		featured_lists: 'https://storeapi.kobo.com/v1/products/featured',
		free_books_page: 'https://www.kobo.com/{region}/{language}/p/free-ebooks',
		free_books_page_alternate: 'https://www.kobo.com/{region}/{language}/p/free-ebooks',
		giftcard_issue: 'https://storeapi.kobo.com/v1/giftcard',
		giftcard_redeem: 'https://storeapi.kobo.com/v1/giftcard/redeem',
		help_page: 'https://help.kobo.com',
		kobo_audiobook_subscription: 'https://storeapi.kobo.com/v1/products/books/subscriptions/kobo-audiobook-subscription',
		library_book: `${koboBase}/v1/library/{Ids}`,
		library_items: `${koboBase}/v1/library`,
		library_metadata: `${koboBase}/v1/library/{Ids}/metadata`,
		library_prices: 'https://storeapi.kobo.com/v1/user/library/previews/prices/{Ids}',
		library_stack: `${koboBase}/v1/library/stacks/{Ids}`,
		library_sync: `${koboBase}/v1/library/sync`,
		love_dashboard_page: 'https://store.kobobooks.com/rebates',
		love_list: 'https://storeapi.kobo.com/v1/user/love',
		magazine_landing_page: 'https://store.kobobooks.com/emagazines',
		notifications_page: 'https://store.kobobooks.com/account/notifications',
		password_retrieval_page: 'https://www.kobo.com/account/resetpassword',
		pocket: 'https://storeapi.kobo.com/v1/pocket/{PocketId}',
		pocket_page: 'https://store.kobobooks.com/pocket',
		privacy_page: 'https://www.kobo.com/privacypolicy',
		product_nextread: 'https://storeapi.kobo.com/v1/products/{ProductId}/nextread',
		product_prices: 'https://storeapi.kobo.com/v1/products/{ProductIds}/prices',
		product_recommendations: 'https://storeapi.kobo.com/v1/products/{ProductId}/recommendations',
		products: 'https://storeapi.kobo.com/v1/products',
		rating: 'https://storeapi.kobo.com/v1/products/{ProductId}/rating/{Rating}',
		reading_services: `${koboBase}/v1/library/{Ids}/state`,
		recommendations: 'https://storeapi.kobo.com/v1/recommendations',
		register_device_page: 'https://store.kobobooks.com/account/manage-devices',
		related_items: 'https://storeapi.kobo.com/v1/products/{Id}/related',
		remaining_book_series: 'https://storeapi.kobo.com/v1/products/books/series/{SeriesId}',
		review: 'https://storeapi.kobo.com/v1/products/{ProductId}/reviews/{ReviewId}',
		reviews: 'https://storeapi.kobo.com/v1/products/{ProductId}/reviews',
		search: 'https://storeapi.kobo.com/v1/search',
		search_page: 'https://store.kobobooks.com/{culture}/search?query={query}',
		self_help_page: 'https://kobo.secure.force.com/selfhelp/apex/ScreenFlow?sfid=a015C000007RFToQAO&appName=kcs&screen=loginInstructions&lang={Language}',
		series: 'https://storeapi.kobo.com/v1/products/books/series/{SeriesId}',
		shelfie_page: 'https://store.kobobooks.com/shelfie',
		sign_in_page: 'https://www.kobo.com/{region}/{language}/account/signin',
		social_authorization_host: 'https://social.kobobooks.com',
		social_host: 'https://social.kobobooks.com/api',
		stacks_host: 'https://store.kobobooks.com',
		stacks_host_productId: 'https://store.kobobooks.com/collections/byproductid/{ProductId}',
		store_home: 'https://store.kobobooks.com',
		store_host: 'https://store.kobobooks.com',
		subscription_host: 'https://subscription.kobobooks.com',
		subscription_info_page: 'https://store.kobobooks.com/subscription',
		subscription_landing_page: 'https://kobo.com/plus',
		super_points_redemption_page: 'https://store.kobobooks.com/account/superpoints',
		terms_page: 'https://www.kobo.com/termsofuse',
		update_library: `${koboBase}/v1/library`,
		use_external_browser: 'false',
		user_host: `${koboBase}`,
		user_migration_host: 'https://store.kobobooks.com',
		user_platform: 'Android',
		user_profile: 'https://storeapi.kobo.com/v1/user/profile',
		user_recommendations: 'https://storeapi.kobo.com/v1/user/recommendations',
		user_reviews: 'https://storeapi.kobo.com/v1/user/{UserId}/reviews',
		user_wishlist: 'https://storeapi.kobo.com/v1/user/wishlist',
		wishlist_page: 'https://store.kobobooks.com/{region}/{language}/account/wishlist'
	};
}

export const GET: RequestHandler = async ({ params, url }) => {
	const { token } = params;

	// Validate token
	const user = await validateToken(token);
	if (!user) {
		throw error(401, 'Invalid or expired token');
	}

	if (!user.syncEnabled) {
		throw error(403, 'Sync is disabled for this account');
	}

	// Generate resources with our server URLs
	const baseUrl = url.origin;
	const resources = generateResources(baseUrl, token);

	// Return in Kobo format
	return json(
		{ Resources: resources },
		{
			headers: {
				'x-kobo-apitoken': 'e30=' // Required empty token
			}
		}
	);
};
