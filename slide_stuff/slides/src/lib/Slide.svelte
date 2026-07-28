<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		eyebrow,
		children,
		footer
	}: {
		title?: string;
		eyebrow?: string;
		children: Snippet;
		footer?: string;
	} = $props();
</script>

<section class="slide">
	{#if title}
		<header class="slide-head">
			{#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
			<h2 class="slide-title">{title}</h2>
		</header>
	{/if}

	<div class="slide-body">
		{@render children()}
	</div>

	{#if footer}
		<footer class="slide-foot">{footer}</footer>
	{/if}
</section>

<style>
	.slide {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: var(--slide-bg);
		padding: 1.6rem 2.6rem 1.4rem;
	}

	.slide-head {
		flex-shrink: 0;
		padding-bottom: 0.9rem;
		margin-bottom: 1.1rem;
		border-bottom: 1px solid var(--border);
	}
	.eyebrow {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.35rem;
	}
	.slide-title {
		font-size: 1.55rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
	}

	.slide-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.slide-foot {
		flex-shrink: 0;
		margin-top: 1rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border);
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.45;
	}
</style>
