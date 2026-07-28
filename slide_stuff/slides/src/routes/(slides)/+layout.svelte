<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { SLIDES } from '$lib/slides';

	let { children } = $props();

	let currentIndex = $derived(SLIDES.indexOf(page.url.pathname as (typeof SLIDES)[number]));

	function next() {
		const n = SLIDES[currentIndex + 1];
		if (n) goto(n);
	}
	function prev() {
		const p = SLIDES[currentIndex - 1];
		if (p) goto(p);
	}

	let isFullscreen = $state(false);
	function toggleFullscreen() {
		if (!document.fullscreenElement) document.documentElement.requestFullscreen();
		else document.exitFullscreen();
	}

	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
				e.preventDefault();
				next();
			} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
				e.preventDefault();
				prev();
			} else if (e.key.toLowerCase() === 'f') {
				toggleFullscreen();
			}
		}
		function onFs() {
			isFullscreen = !!document.fullscreenElement;
		}
		window.addEventListener('keydown', onKey);
		document.addEventListener('fullscreenchange', onFs);
		return () => {
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('fullscreenchange', onFs);
		};
	});
</script>

<div class="deck">
	<header class="bar">
		<span class="deck-title">Cryogenic Micro-Coax · Loss &amp; Heat-Load Projections</span>
		<div class="bar-right">
			<button class="fs" onclick={toggleFullscreen} aria-label="Toggle fullscreen">
				{isFullscreen ? '⤓' : '⤢'}
			</button>
			<span class="counter mono">{currentIndex + 1} / {SLIDES.length}</span>
		</div>
	</header>

	<main class="stage">
		{@render children()}

		<!-- click navigation zones -->
		<button class="zone zone-prev" onclick={prev} aria-label="Previous slide" tabindex="-1"></button>
		<button class="zone zone-next" onclick={next} aria-label="Next slide" tabindex="-1"></button>
	</main>

	<footer class="progress">
		<div class="progress-fill" style="width: {((currentIndex + 1) / SLIDES.length) * 100}%"></div>
	</footer>
</div>

<style>
	.deck {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		user-select: none;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--slide-bg);
		flex-shrink: 0;
	}
	.deck-title {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}
	.bar-right {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.counter {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.fs {
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.95rem;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
		line-height: 1;
	}
	.fs:hover {
		background: var(--surface-2);
		color: var(--text-secondary);
	}

	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.zone {
		position: absolute;
		top: 0;
		bottom: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 0;
		z-index: 5;
	}
	.zone-prev {
		left: 0;
		width: 16%;
		cursor: w-resize;
	}
	.zone-next {
		right: 0;
		width: 30%;
		cursor: e-resize;
	}

	.progress {
		height: 3px;
		background: var(--surface-2);
		flex-shrink: 0;
	}
	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.25s ease;
	}
</style>
