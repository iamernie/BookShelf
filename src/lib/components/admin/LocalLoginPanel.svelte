<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { KeyRound, AlertTriangle, Eye, EyeOff, Copy, RefreshCw, Loader2 } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import ConfirmDialog from './ConfirmDialog.svelte';

	// Password sign-in switch and the emergency sign-in URL. The load sends state only: the URL is
	// fetched from the admin-only no-store endpoint when Show or Copy is clicked, never rendered.
	interface LocalLoginState {
		disabled: boolean;
		secretSet: boolean;
		needsRepair: boolean;
		lastUsedAt: string | null;
		enabledProviderCount: number;
		actingAdminLinked: boolean;
		unlinkedUsers: { username: string }[];
		allowSignup: boolean;
	}

	let { state: s, origin }: { state: LocalLoginState; origin: string } = $props();

	const API = '/api/admin/auth/local-login';
	const masked = $derived(`${origin}/login?local=1&t=••••••••••••`);

	let confirming = $state<'off' | 'rotate' | null>(null);
	let busy = $state(false);
	let revealedUrl = $state<string | null>(null);

	async function readError(res: Response, fallback: string): Promise<string> {
		const body = await res.json().catch(() => null);
		return body?.message || fallback;
	}

	async function fetchUrl(): Promise<string | null> {
		const res = await fetch(API, { cache: 'no-store' });
		if (!res.ok) {
			toasts.error(await readError(res, "Couldn't load the emergency sign-in URL"));
			return null;
		}
		const body = await res.json();
		return body.url ?? null;
	}

	async function show() {
		if (revealedUrl) {
			revealedUrl = null;
			return;
		}
		revealedUrl = await fetchUrl();
	}

	async function copy() {
		const url = revealedUrl ?? (await fetchUrl());
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toasts.success('Emergency sign-in URL copied');
		} catch {
			revealedUrl = url;
			toasts.error("Couldn't copy. The URL is shown so you can copy it by hand.");
		}
	}

	async function setDisabled(disabled: boolean) {
		busy = true;
		try {
			const res = await fetch(API, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ disabled })
			});
			if (!res.ok) {
				toasts.error(await readError(res, 'Failed to change password sign-in'));
				return;
			}
			confirming = null;
			revealedUrl = null;
			toasts.success(disabled
				? 'Password sign-in is off. Save the emergency sign-in URL somewhere outside BookShelf.'
				: 'Password sign-in is on again. The emergency URL is kept for next time.');
			await invalidateAll();
		} catch {
			toasts.error('An error occurred');
		} finally {
			busy = false;
		}
	}

	async function rotate() {
		busy = true;
		try {
			const res = await fetch(`${API}/rotate`, { method: 'POST', cache: 'no-store' });
			if (!res.ok) {
				toasts.error(await readError(res, 'Failed to rotate the URL'));
				return;
			}
			const body = await res.json();
			confirming = null;
			revealedUrl = body.url ?? null;
			toasts.success('New emergency sign-in URL created. Copy it before you leave this page.');
			await invalidateAll();
		} catch {
			toasts.error('An error occurred');
		} finally {
			busy = false;
		}
	}

	const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');
</script>

<section class="local-login-panel rounded-lg p-4 mb-6" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-start gap-3">
			<KeyRound class="w-5 h-5 mt-0.5 flex-shrink-0" style="color: var(--accent);" />
			<div>
				<h2 class="font-semibold" style="color: var(--text-primary);">Password sign-in</h2>
				<p class="text-sm" style="color: var(--text-muted);">
					{#if s.disabled}
						Off. Everyone signs in through single sign-on.
					{:else}
						On. People can sign in with their email and password as well as single sign-on.
					{/if}
				</p>
			</div>
		</div>
		{#if s.disabled}
			<button type="button" class="local-login-on btn-ghost px-4 py-2 rounded-lg text-sm" onclick={() => setDisabled(false)} disabled={busy}>
				Turn password sign-in back on
			</button>
		{:else}
			<button type="button" class="local-login-off px-4 py-2 rounded-lg text-sm font-medium" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);" onclick={() => (confirming = 'off')} disabled={busy}>
				Turn off password sign-in
			</button>
		{/if}
	</div>

	{#if !s.disabled && (s.enabledProviderCount === 0 || !s.actingAdminLinked)}
		<p class="local-login-precheck text-xs mt-3" style="color: var(--text-muted);">
			{#if s.enabledProviderCount === 0}
				To turn it off, first add and enable a single sign-on provider.
			{:else}
				To turn it off, first link your own account to a single sign-on provider from your account settings.
			{/if}
		</p>
	{/if}

	{#if !s.disabled && s.secretSet}
		<p class="text-xs mt-3" style="color: var(--text-muted);">
			The emergency sign-in URL from last time is kept and works again if you turn password sign-in off.
			<button type="button" class="local-login-rotate-off hover:underline" style="color: var(--accent);" onclick={() => (confirming = 'rotate')}>Rotate it</button>
		</p>
	{/if}

	{#if s.disabled}
		<div class="local-login-warning mt-4 rounded-lg p-4 border border-amber-500/40 bg-amber-500/10">
			{#if s.needsRepair}
				<p class="local-login-repair text-sm mb-3 text-red-400">
					Password sign-in is off but there is no emergency sign-in URL. Create one now with Rotate URL.
				</p>
			{/if}
			<div class="flex items-start gap-2">
				<AlertTriangle class="w-5 h-5 flex-shrink-0 text-amber-500" />
				<div class="text-sm space-y-3" style="color: var(--text-secondary);">
					<p>
						<strong>Password sign-in is off.</strong> If your single sign-on provider goes down or is misconfigured,
						the only way back in is this emergency sign-in URL:
					</p>
					{#if s.secretSet}
						<div class="flex flex-wrap items-center gap-2">
							<code class="local-login-url text-xs px-2 py-1 rounded break-all" style="background: var(--bg-primary); color: var(--accent);">{revealedUrl ?? masked}</code>
							<button type="button" class="flex items-center gap-1 text-xs hover:underline" style="color: var(--accent);" onclick={show}>
								{#if revealedUrl}<EyeOff class="w-3.5 h-3.5" /> Hide{:else}<Eye class="w-3.5 h-3.5" /> Show{/if}
							</button>
							<button type="button" class="flex items-center gap-1 text-xs hover:underline" style="color: var(--accent);" onclick={copy}>
								<Copy class="w-3.5 h-3.5" /> Copy
							</button>
						</div>
					{/if}
					<p>
						Save it somewhere outside BookShelf. Each use opens password sign-in for 15 minutes on that browser and is
						recorded in the logs.
					</p>
					<p class="flex flex-wrap items-center gap-2">
						<span class="local-login-last-used">Last used: {when(s.lastUsedAt)}</span>
						<span aria-hidden="true">·</span>
						<button type="button" class="local-login-rotate flex items-center gap-1 hover:underline" style="color: var(--accent);" onclick={() => (confirming = 'rotate')} disabled={busy}>
							<RefreshCw class="w-3.5 h-3.5" /> Rotate URL
						</button>
					</p>
				</div>
			</div>
		</div>
	{/if}

	<details class="local-login-help mt-3 text-xs" style="color: var(--text-muted);">
		<summary class="cursor-pointer">About password sign-in and the emergency URL</summary>
		<ul class="list-disc pl-5 mt-2 space-y-1">
			<li>Turning password sign-in off doesn't end anyone's current session.</li>
			<li>OPDS catalogs for e-readers still sign in with an email and password. They can't use single sign-on.</li>
			<li>Accounts with no single sign-on link can still link one from the sign-in page with their password, after signing in with their provider.</li>
			<li>
				The secret never appears in BookShelf's own logs. Your reverse proxy probably logs full URLs, query string
				included, so rotate the URL after each use.
			</li>
			<li>
				Opening the URL takes the secret out of the address bar, but your browser may still remember the URL you
				pasted or typed.
			</li>
			<li>
				Repeated wrong URLs are rate limited by the address in the X-Forwarded-For header, which a client can set.
				The real protection is the secret's length.
			</li>
		</ul>
	</details>
</section>

{#if confirming === 'off'}
	<ConfirmDialog
		title="Turn off password sign-in"
		confirmLabel="Turn off password sign-in"
		busyLabel="Turning off..."
		{busy}
		onConfirm={() => setDisabled(true)}
		onCancel={() => (confirming = null)}
	>
		<p>Everyone will have to sign in through single sign-on.</p>
		{#if s.unlinkedUsers.length > 0}
			<p class="local-login-unlinked">
				These accounts have no single sign-on link and won't be able to sign in until they link one or you turn
				password sign-in back on: <strong>{s.unlinkedUsers.map((u) => u.username).join(', ')}</strong>.
			</p>
		{/if}
		{#if s.allowSignup}
			<p class="local-login-signup">
				Public signup is on. New accounts it creates will only be able to sign in through single sign-on or after
				linking.
			</p>
		{/if}
		<p>Existing signed-in sessions are not ended.</p>
		<p>You'll get an emergency sign-in URL to save somewhere outside BookShelf.</p>
	</ConfirmDialog>
{:else if confirming === 'rotate'}
	<ConfirmDialog
		title="Rotate emergency sign-in URL"
		confirmLabel="Rotate URL"
		busyLabel="Rotating..."
		{busy}
		onConfirm={rotate}
		onCancel={() => (confirming = null)}
	>
		<p>
			The current emergency URL stops working immediately, including any emergency sign-in windows already open.
			Copy the new one before closing this page.
		</p>
	</ConfirmDialog>
{/if}
