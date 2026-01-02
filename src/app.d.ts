// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user: {
				id: number;
				username: string;
				email: string;
				role: string;
				firstName: string | null;
				lastName: string | null;
			} | null;
		}
		interface PageData {
			user: App.Locals['user'];
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
