<script lang="ts">
	// One cryostat stage, one assembly length, one scaled-up cable — against the
	// N12-42M baseline it was scaled from.  Heat load is the headline here (the
	// length slides lead with insertion loss), so the stage's Q̇ is the hero
	// number and RF loss sits underneath as context.
	//
	// Everything is evaluated at the slide's own stage, including the RF loss:
	// on a 4→1 K slide α is taken at T̄ = 2.5 K, not at the 22 K used on the
	// 40→4 K slides.
	import Slide from './Slide.svelte';
	import CableCrossSection from './CableCrossSection.svelte';
	import { N12, presetResults, inches, type CoaxPreset, type Stage } from './compute';
	import { fmt, mm, mils, heatParts, fmtHeat } from './format';

	let { variant, lengthIn, stage }: { variant: CoaxPreset; lengthIn: number; stage: Stage } =
		$props();

	const F_LOW = 2e9;
	const F_HIGH = 4e9;
	const BUNDLE = 208; // full harness: 13 × 16 cables

	const STAGE_LABEL: Record<string, string> = {
		'40to4': '40 K → 4 K',
		'4to1': '4 K → 1 K',
		calRT: '295 K'
	};

	function buildCol(preset: CoaxPreset, accent: string) {
		const L = inches(lengthIn);
		const r = presetResults(preset, L, F_LOW, stage);
		return {
			preset,
			accent,
			z0: r.Z0,
			odMm: mm(r.cableOD),
			odMils: mils(r.cableOD),
			od: r.cableOD,
			il2: r.totalLoss_dB,
			il4: presetResults(preset, L, F_HIGH, stage).totalLoss_dB,
			heat: r.Qtotal_uW
		};
	}

	let cols = $derived([buildCol(N12, 'var(--accent2)'), buildCol(variant, 'var(--accent3)')]);

	// Scaling up buys loss and costs heat — quote both as a plain multiple of
	// the baseline so the trade reads off the slide.
	let heatMult = $derived(cols[1].heat / cols[0].heat);
	let lossAdv = $derived(cols[0].il2 / cols[1].il2);
	let odMult = $derived(cols[1].od / cols[0].od);

	let mmIn = $derived((lengthIn * 25.4).toFixed(0));
	let stageLabel = $derived(STAGE_LABEL[stage]);
</script>

<Slide
	eyebrow={`Radius scaling · ${stageLabel}`}
	title={`${variant.name} vs baseline · ${lengthIn}″ assembly · ${mmIn} mm`}
	footer={`Heat load = steady-state conduction Q̇ across the ${stageLabel} ΔT, per cable and for the full 208-cable harness (13 × 16). RF insertion loss = α(f)·L with ρ, ε_r and tan δ taken at this stage's T̄. ${variant.name} is the N12-42M construction (brass / PFA / spiral shield) scaled up, re-sized to hold 50 Ω and 0.78 shield coverage; its OD is ${fmt(odMult, 2)}× the baseline.`}
>
	<div class="cols">
		{#each cols as c (c.preset.key)}
			<article class="card" style="--c: {c.accent}">
				<header class="card-head">
					<div class="head-text">
						<h3 class="cable-name">{c.preset.name}</h3>
						<p class="cable-desc">{c.preset.description}</p>
					</div>
					<!-- Both cards drawn to the (larger) variant's scale, so the
					     size difference is the thing you see first. -->
					<div class="xsec">
						<CableCrossSection preset={c.preset} refPreset={variant} size={82} />
					</div>
				</header>

				<div class="chips mono">
					<span class="chip"><b>Z₀</b>{fmt(c.z0, 1)} Ω</span>
					<span class="chip"><b>OD</b>{c.odMm} mm · {c.odMils} mil</span>
				</div>

				<div class="group">
					<div class="group-label">Conducted heat load · {stageLabel}</div>
					<div class="stat">
						<span class="stat-key mono">per cable</span>
						<span class="stat-val mono">{heatParts(c.heat).v}<i>{heatParts(c.heat).u}</i></span>
					</div>
					<div class="stat sub">
						<span class="stat-key mono">× {BUNDLE} harness</span>
						<span class="stat-val mono">{fmtHeat(c.heat * BUNDLE)}</span>
					</div>
				</div>

				<div class="group">
					<div class="group-label">RF insertion loss</div>
					<div class="stat sub">
						<span class="stat-key mono">2 GHz</span>
						<span class="stat-val mono">{fmt(c.il2, 2)}<i>dB</i></span>
					</div>
					<div class="stat sub">
						<span class="stat-key mono">4 GHz</span>
						<span class="stat-val mono">{fmt(c.il4, 2)}<i>dB</i></span>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<div class="compare mono">
		<span class="delta">
			Trade-off · <b style="color:var(--accent3)">{variant.name}</b>
			{fmt(heatMult, 1)}× the heat · {fmt(lossAdv, 1)}× lower loss · {fmt(odMult, 2)}× the OD
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
	.stat:first-of-type {
		margin-top: 0;
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
