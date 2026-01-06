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
		// Core API endpoint - this is the main one the device uses
		api_endpoint: koboBase,

		// Image URLs - point to our server for local books
		image_host: baseUrl,
		image_url_template: `${koboBase}/v1/books/{ImageId}/thumbnail/{Width}/{Height}/false/image.jpg`,
		image_url_quality_template: `${koboBase}/v1/books/{ImageId}/thumbnail/{Width}/{Height}/{Quality}/{IsGreyscale}/image.jpg`,

		// Account and authentication
		account_page: 'https://www.kobo.com/account/settings',
		account_page_rakuten: 'https://my.rakuten.co.jp/',
		authentication_host: koboBase,
		device_auth: `${koboBase}/v1/auth/device`,
		device_refresh: `${koboBase}/v1/auth/refresh`,
		oauth_host: 'https://oauth.kobo.com',
		sign_in_page: 'https://auth.kobobooks.com/ActivateOnWeb',
		registration_page: 'https://authorize.kobo.com/signup?returnUrl=https://kobo.com/',
		password_retrieval_page: 'https://www.kobo.com/account/resetpassword',

		// Library endpoints - these are critical for sync
		library_book: `${koboBase}/v1/library/{Ids}`,
		library_items: `${koboBase}/v1/library`,
		library_metadata: `${koboBase}/v1/library/{Ids}/metadata`,
		library_sync: `${koboBase}/v1/library/sync`,
		library_prices: 'https://storeapi.kobo.com/v1/user/library/previews/prices/{Ids}',
		library_stack: `${koboBase}/v1/library/stacks/{Ids}`,
		update_library: `${koboBase}/v1/library`,

		// Reading services - required for reading state sync
		reading_services: `${koboBase}/v1/library/{Ids}/state`,
		reading_services_host: koboBase,

		// User endpoints
		user_host: koboBase,
		user_platform: 'Android',
		user_profile: 'https://storeapi.kobo.com/v1/user/profile',
		user_recommendations: 'https://storeapi.kobo.com/v1/user/recommendations',
		user_reviews: 'https://storeapi.kobo.com/v1/user/{UserId}/reviews',
		user_wishlist: 'https://storeapi.kobo.com/v1/user/wishlist',
		user_ratings: 'https://storeapi.kobo.com/v1/user/ratings',
		user_migration_host: 'https://store.kobobooks.com',

		// Store and product endpoints
		affiliate: 'https://storeapi.kobo.com/v1/affiliate',
		autocomplete: 'https://storeapi.kobo.com/v1/products/autocomplete',
		book: 'https://storeapi.kobo.com/v1/products/books/{ProductId}',
		book_detail_page: 'https://www.kobo.com/{region}/{language}/ebook/{slug}',
		book_detail_page_rakuten: 'http://books.rakuten.co.jp/rk/{crossrevisionid}',
		book_landing_page: 'https://www.kobo.com/ebooks',
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
		dictionary_host: 'https://kbdownload1-a.akamaihd.net',
		external_book: 'https://storeapi.kobo.com/v1/products/books/external/{Ids}',
		featured_list: 'https://storeapi.kobo.com/v1/products/featured/{FeaturedListId}',
		featured_lists: 'https://storeapi.kobo.com/v1/products/featured',
		free_books_page: 'https://www.kobo.com/{region}/{language}/p/free-ebooks',
		free_books_page_alternate: 'https://www.kobo.com/{region}/{language}/p/free-ebooks',
		products: 'https://storeapi.kobo.com/v1/products',
		product_nextread: 'https://storeapi.kobo.com/v1/products/{ProductId}/nextread',
		product_prices: 'https://storeapi.kobo.com/v1/products/{ProductIds}/prices',
		product_recommendations: 'https://storeapi.kobo.com/v1/products/{ProductId}/recommendations',
		product_reviews: 'https://storeapi.kobo.com/v1/products/{ProductIds}/reviews',
		rating: 'https://storeapi.kobo.com/v1/products/{ProductId}/rating/{Rating}',
		recommendations: 'https://storeapi.kobo.com/v1/recommendations',
		related_items: 'https://storeapi.kobo.com/v1/products/{Id}/related',
		remaining_book_series: 'https://storeapi.kobo.com/v1/products/books/series/{SeriesId}',
		review: 'https://storeapi.kobo.com/v1/products/{ProductId}/reviews/{ReviewId}',
		reviews: 'https://storeapi.kobo.com/v1/products/{ProductId}/reviews',
		search: 'https://storeapi.kobo.com/v1/search',
		search_page: 'https://store.kobobooks.com/{culture}/search?query={query}',
		series: 'https://storeapi.kobo.com/v1/products/books/series/{SeriesId}',
		store_home: 'https://store.kobobooks.com',
		store_host: 'https://store.kobobooks.com',
		store_search: 'https://www.kobo.com/{region}/{language}/Search?Query={query}',
		taste_profile: 'https://storeapi.kobo.com/v1/products/tasteprofile',
		purchase_buy_templated: 'https://www.kobo.com/{region}/{language}/checkoutoption/{ProductId}',

		// Kobo features
		audiobook_landing_page: 'https://store.kobobooks.com/audiobooks',
		kobo_audiobook_subscription: 'https://storeapi.kobo.com/v1/products/books/subscriptions/kobo-audiobook-subscription',
		kobo_audiobooks_enabled: 'True',
		kobo_audiobooks_credit_redemption: 'False',
		kobo_nativeborrow_enabled: 'True',
		kobo_redeem_enabled: 'True',
		kobo_subscriptions_enabled: 'True',
		kobo_superpoints_enabled: 'True',
		kobo_wishlist_enabled: 'True',
		kobo_dropbox_link_account_enabled: 'False',
		kobo_googledrive_link_account_enabled: 'False',
		kobo_privacyCentre_url: 'https://www.kobo.com/privacy',

		// Instapaper integration
		instapaper_enabled: 'True',
		instapaper_env_url: 'https://www.instapaper.com/api/kobo',
		instapaper_link_account_start: 'https://authorize.kobo.com/{region}/{language}/linkinstapaper',

		// Social features
		social_authorization_host: 'https://social.kobobooks.com',
		social_host: 'https://social.kobobooks.com/api',

		// Other pages and services
		eula_page: 'https://www.kobo.com/termsofuse?style=onestore',
		giftcard_issue: 'https://storeapi.kobo.com/v1/giftcard',
		giftcard_redeem: 'https://storeapi.kobo.com/v1/giftcard/redeem',
		help_page: 'https://help.kobo.com',
		love_dashboard_page: 'https://store.kobobooks.com/rebates',
		love_list: 'https://storeapi.kobo.com/v1/user/love',
		love_points_redemption_page: 'https://www.kobo.com/{region}/{language}/KoboSuperPointsRedemption?productId={ProductId}',
		magazine_landing_page: 'https://store.kobobooks.com/emagazines',
		notifications_page: 'https://store.kobobooks.com/account/notifications',
		pocket: 'https://storeapi.kobo.com/v1/pocket/{PocketId}',
		pocket_page: 'https://store.kobobooks.com/pocket',
		pocket_link_account_start: 'https://authorize.kobo.com/{region}/{language}/linkpocket',
		privacy_page: 'https://www.kobo.com/privacypolicy?style=onestore',
		register_device_page: 'https://store.kobobooks.com/account/manage-devices',
		self_help_page: 'https://kobo.secure.force.com/selfhelp/apex/ScreenFlow?sfid=a015C000007RFToQAO&appName=kcs&screen=loginInstructions&lang={Language}',
		shelfie_page: 'https://store.kobobooks.com/shelfie',
		stacks_host: 'https://store.kobobooks.com',
		stacks_host_productId: 'https://store.kobobooks.com/collections/byproductid/{ProductId}',
		subscription_host: 'https://subscription.kobobooks.com',
		subscription_info_page: 'https://store.kobobooks.com/subscription',
		subscription_landing_page: 'https://kobo.com/plus',
		subs_landing_page: 'https://www.kobo.com/{region}/{language}/plus',
		subs_management_page: 'https://www.kobo.com/{region}/{language}/account/subscriptions',
		subs_plans_page: 'https://www.kobo.com/{region}/{language}/plus/plans',
		subs_purchase_buy_templated: 'https://www.kobo.com/{region}/{language}/Checkoutoption/{ProductId}/{TierId}',
		super_points_redemption_page: 'https://store.kobobooks.com/account/superpoints',
		terms_page: 'https://www.kobo.com/termsofuse',
		wishlist_page: 'https://store.kobobooks.com/{region}/{language}/account/wishlist',

		// Display settings
		display_accessibility_enabled: 'False',
		display_parental_controls_enabled: 'False',
		use_external_browser: 'false',

		// Host settings
		userguide_host: 'https://ereaderfiles.kobo.com',
		client_authd_referral: 'https://authorize.kobo.com/api/AuthenticatedReferral/client/v1/getLink',
		fte_feedback: 'https://storeapi.kobo.com/v1/products/ftefeedback',
		feedback: ''
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
