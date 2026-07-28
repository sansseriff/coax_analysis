<script lang="ts">
	import Slide from './Slide.svelte';
	import CableCrossSection from './CableCrossSection.svelte';
	import { SAMTEC, N12, presetResults, inches, type CoaxPreset } from './compute';
	import { fmt, mm, mils, heatParts } from './format';

	let { lengthIn }: { lengthIn: number } = $props();

	const F_LOW = 2e9;
	const F_HIGH = 4e9;

	interface Col {
		preset: CoaxPreset;
		accent: string; // css var name
		z0: number;
		odMm: string;
		odMils: string;
		il2: number;
		il4: number;
		heatHi: number; // 40 K -> 4 K
		heatLo: number; // 4 K -> 1 K
	}

	function buildCol(preset: CoaxPreset, accent: string): Col {
		const L = inches(lengthIn);
		const hi = presetResults(preset, L, F_LOW, '40to4');
		const il4 = presetResults(preset, L, F_HIGH, '40to4').totalLoss_dB;
		const lo = presetResults(preset, L, F_LOW, '4to1');
		return {
			preset,
			accent,
			z0: hi.Z0,
			odMm: mm(hi.cableOD),
			odMils: mils(hi.cableOD),
			il2: hi.totalLoss_dB,
			il4,
			heatHi: hi.Qtotal_uW,
			heatLo: lo.Qtotal_uW
		};
	}

	let cols = $derived([
		buildCol(SAMTEC, 'var(--accent)'),
		buildCol(N12, 'var(--accent2)')
	]);

	// Trade-off framing: TCF-3450F (SPC/copper) wins on loss, N12-42M (brass)
	// wins on heat. Express each as a "× lower" advantage so both read ≥ 1.
	let lossAdvTCF = $derived(cols[1].il2 / cols[0].il2);
	let heatAdvN12 = $derived(cols[0].heatHi / cols[1].heatHi);

	let mmIn = $derived((lengthIn * 25.4).toFixed(0));
</script>

<Slide
	eyebrow="Cable length"
	title={`${lengthIn}″ assembly · ${mmIn} mm`}
	footer="RF insertion loss = total α(f)·L at the 4–40 K stage (T̄ ≈ 22 K), conductor + dielectric. Heat load = steady-state conduction Q̇ across each stage's ΔT, per cable. Model: Pozar α_c with per-conductor stranding factor K_s (calibrated to the TCF-3450F IL curve, 1–4 GHz). Both cables 50 Ω."
>
	<div class="cols">
		{#each cols as c (c.preset.key)}
			<article class="card" style="--c: {c.accent}">
				<header class="card-head">
					<div class="head-text">
						<h3 class="cable-name">{c.preset.name}</h3>
						<p class="cable-desc">{c.preset.description}</p>
					</div>
					<div class="xsec">
						<CableCrossSection preset={c.preset} size={82} />
					</div>
				</header>

				<div class="chips mono">
					<span class="chip"><b>Z₀</b>{fmt(c.z0, 1)} Ω</span>
					<span class="chip"><b>OD</b>{c.odMm} mm · {c.odMils} mil</span>
				</div>

				<div class="group">
					<div class="group-label">RF insertion loss</div>
					<div class="stat">
						<span class="stat-key mono">2 GHz</span>
						<span class="stat-val mono">{fmt(c.il2, 2)}<i>dB</i></span>
					</div>
					<div class="stat sub">
						<span class="stat-key mono">4 GHz</span>
						<span class="stat-val mono">{fmt(c.il4, 2)}<i>dB</i></span>
					</div>
				</div>

				<div class="group">
					<div class="group-label">Conducted heat load · per cable</div>
					<div class="stat">
						<span class="stat-key mono">40 K → 4 K</span>
						<span class="stat-val mono"
							>{heatParts(c.heatHi).v}<i>{heatParts(c.heatHi).u}</i></span
						>
					</div>
					<div class="stat sub">
						<span class="stat-key mono">4 K → 1 K</span>
						<span class="stat-val mono"
							>{heatParts(c.heatLo).v}<i>{heatParts(c.heatLo).u}</i></span
						>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<div class="compare mono">
		<span class="delta">
			Trade-off · <b style="color:var(--accent)">TCF-3450F</b> {fmt(lossAdvTCF, 1)}× lower loss
			· <b style="color:var(--accent2)">N12-42M</b> {fmt(heatAdvN12, 0)}× lower heat
		</span>
	</div>
</Slide>

<style>
	.cols {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.4rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-top: 3px solid var(--c);
		border-radius: 12px;
		background: var(--slide-bg);
		padding: 1.3rem 1.5rem 1.4rem;
		box-shadow: 0 1px 2px rgba(20, 30, 50, 0.04);
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}
	.head-text {
		min-width: 0;
	}
	.xsec {
		flex-shrink: 0;
		line-height: 0;
	}
	.cable-name {
		font-size: 1.18rem;
		font-weight: 700;
		color: var(--c);
		letter-spacing: -0.01em;
	}
	.cable-desc {
		margin-top: 0.25rem;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--text-secondary);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.2rem;
	}
	.chip {
		font-size: 0.74rem;
		color: var(--text-secondary);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.28rem 0.55rem;
	}
	.chip b {
		color: var(--text-muted);
		font-weight: 600;
		margin-right: 0.45rem;
		text-transform: uppercase;
		font-size: 0.66rem;
		letter-spacing: 0.06em;
	}

	.group {
		padding: 0.9rem 0 0.2rem;
		border-top: 1px solid var(--border);
	}
	.group:first-of-type {
		border-top: none;
		padding-top: 0;
	}
	.group-label {
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.65rem;
	}

	.stat {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.stat.sub {
		margin-top: 0.55rem;
	}
	.stat-key {
		font-size: 0.82rem;
		color: var(--text-secondary);
	}
	.stat-val {
		font-size: 1.85rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1;
	}
	.stat.sub .stat-val {
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text-secondary);
	}
	.stat-val i {
		font-style: normal;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-muted);
		margin-left: 0.28rem;
	}

	.compare {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.1rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
	}
	.delta b {
		color: var(--text-primary);
		font-weight: 700;
	}
</style>
