<script lang="ts">
	// Compact stranded-coax cross-section for the column slides. Derived from the
	// calculator's CoaxCrossSection.svelte, with the dimension annotations stripped
	// out and geometry read straight from a preset. Radii are drawn in metres and
	// normalised by the viewBox so any cable fits.
	import { awgToMeters } from './physics/awg';
	import type { CoaxPreset } from './compute';

	// `refPreset` draws this cable to *another* cable's scale instead of its own,
	// so two cards side by side can be compared at a glance. Left unset, every
	// cross-section fills its own box (the original behaviour).
	let {
		preset,
		size = 78,
		refPreset
	}: { preset: CoaxPreset; size?: number; refPreset?: CoaxPreset } = $props();

	let rInner = $derived(awgToMeters(preset.innerAwg) / 2);
	let rOuterStrand = $derived(awgToMeters(preset.outerAwg) / 2);
	let rRing = $derived(preset.rRing_um * 1e-6);
	let nOuter = $derived(preset.nOuter);
	let a = $derived(3 * rInner); // dielectric inner radius = bundle envelope

	let metalColor = $derived(
		preset.metal === 'brass' ? 'var(--color-brass)' : 'var(--color-copper)'
	);

	const padFrac = 0.04;
	let scaleTo = $derived(refPreset ?? preset);
	let halfBox = $derived(
		(scaleTo.rRing_um * 1e-6 + awgToMeters(scaleTo.outerAwg) / 2) * (1 + padFrac)
	);

	// Inner 7-strand hex bundle: centre + 6 petals at 2·rInner.
	let innerCenters = $derived(
		[{ x: 0, y: 0 }].concat(
			Array.from({ length: 6 }, (_, k) => ({
				x: 2 * rInner * Math.cos((k * Math.PI) / 3),
				y: 2 * rInner * Math.sin((k * Math.PI) / 3)
			}))
		)
	);

	// Outer shield: nOuter strands evenly spaced on the ring.
	let outerCenters = $derived(
		Array.from({ length: nOuter }, (_, k) => ({
			x: rRing * Math.cos((2 * Math.PI * k) / nOuter),
			y: rRing * Math.sin((2 * Math.PI * k) / nOuter)
		}))
	);
</script>

<svg
	viewBox="{-halfBox} {-halfBox} {2 * halfBox} {2 * halfBox}"
	width={size}
	height={size}
	role="img"
	aria-label="{preset.name}{refPreset && refPreset.key !== preset.key
		? ` at ${refPreset.name} scale`
		: ''} cross-section"
>
	<!-- jacket / shield envelope -->
	<circle
		cx="0"
		cy="0"
		r={rRing + rOuterStrand}
		fill="var(--color-jacket)"
		stroke="var(--border-strong)"
		stroke-width={halfBox * 0.004}
	/>
	<!-- dielectric -->
	<circle cx="0" cy="0" r={rRing - rOuterStrand} fill="var(--color-dielectric)" />

	<!-- outer shield strands -->
	{#each outerCenters as c}
		<circle
			cx={c.x}
			cy={c.y}
			r={rOuterStrand}
			fill={metalColor}
			stroke="rgba(0,0,0,0.32)"
			stroke-width={halfBox * 0.002}
		/>
	{/each}

	<!-- inner core dielectric -->
	<circle cx="0" cy="0" r={a} fill="var(--color-dielectric)" opacity="0.6" />

	<!-- inner 7-strand bundle -->
	{#each innerCenters as c}
		<circle
			cx={c.x}
			cy={c.y}
			r={rInner}
			fill={metalColor}
			stroke="rgba(0,0,0,0.32)"
			stroke-width={halfBox * 0.002}
		/>
	{/each}
</svg>
