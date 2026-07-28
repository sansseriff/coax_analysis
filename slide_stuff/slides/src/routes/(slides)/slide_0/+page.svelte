<script lang="ts">
	import Slide from '$lib/Slide.svelte';
	import { SAMTEC, N12, presetResults, inches, type CoaxPreset } from '$lib/compute';
	import { fmt, mm, mils } from '$lib/format';

	// Z₀ and OD are length-independent; evaluate at a nominal 1″ to read them off.
	function spec(p: CoaxPreset) {
		const r = presetResults(p, inches(1), 2e9, '40to4');
		return {
			name: p.name,
			desc: p.description,
			z0: fmt(r.Z0, 1),
			odMm: mm(r.cableOD),
			odMils: mils(r.cableOD),
			alpha: fmt(r.alphaTotal_dBm, 2) // dB/m at 2 GHz, 22 K
		};
	}

	const samtec = spec(SAMTEC);
	const n12 = spec(N12);
</script>

<Slide>
	<div class="title-wrap">
		<div class="hero">
			<div class="kicker mono">50 Ω stranded micro-coax · cryostat wiring</div>
			<h1>Insertion Loss &amp; Heat-Load Projections</h1>
			<p class="lede">
				Hard numbers for RF insertion loss and conducted heat load of two candidate
				micro-coax cables, at assembly lengths of <b>3″, 5″, 10″, 15″ and 18″</b>.
			</p>
		</div>

		<div class="intro-cols">
			<article class="icard" style="--c: var(--accent)">
				<h3>{samtec.name}</h3>
				<p class="d">{samtec.desc}</p>
				<dl class="mono">
					<div><dt>Z₀</dt><dd>{samtec.z0} Ω</dd></div>
					<div><dt>Cable OD</dt><dd>{samtec.odMm} mm · {samtec.odMils} mil</dd></div>
					<div><dt>α @ 2 GHz</dt><dd>{samtec.alpha} dB/m</dd></div>
				</dl>
			</article>

			<article class="icard" style="--c: var(--accent2)">
				<h3>{n12.name}</h3>
				<p class="d">{n12.desc}</p>
				<dl class="mono">
					<div><dt>Z₀</dt><dd>{n12.z0} Ω</dd></div>
					<div><dt>Cable OD</dt><dd>{n12.odMm} mm · {n12.odMils} mil</dd></div>
					<div><dt>α @ 2 GHz</dt><dd>{n12.alpha} dB/m</dd></div>
				</dl>
			</article>
		</div>

		<div class="notes mono">
			RF model: Pozar conductor loss + dielectric loss, with per-conductor stranding
			factor K_s calibrated to the TCF-3450F insertion-loss curve (1–4 GHz). Heat load:
			steady-state conduction across each cryostat stage's ΔT, with lay-angle path
			corrections. Use ← → to navigate.
		</div>
	</div>
</Slide>

<style>
	.title-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1.8rem;
		max-width: 1000px;
		margin: 0 auto;
		width: 100%;
	}

	.kicker {
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--accent);
		margin-bottom: 0.7rem;
	}
	.hero h1 {
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.08;
		color: var(--text-primary);
	}
	.lede {
		margin-top: 0.9rem;
		font-size: 1.02rem;
		line-height: 1.5;
		color: var(--text-secondary);
		max-width: 46rem;
	}
	.lede b {
		color: var(--text-primary);
		font-weight: 600;
	}

	.intro-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.4rem;
	}
	.icard {
		border: 1px solid var(--border);
		border-left: 3px solid var(--c);
		border-radius: 10px;
		background: var(--surface);
		padding: 1.1rem 1.3rem;
	}
	.icard h3 {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--c);
	}
	.icard .d {
		margin-top: 0.3rem;
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--text-secondary);
		min-height: 2.2em;
	}
	.icard dl {
		margin: 0.9rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.icard dl div {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
	}
	.icard dt {
		color: var(--text-muted);
	}
	.icard dd {
		margin: 0;
		font-weight: 600;
		color: var(--text-primary);
	}

	.notes {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--text-muted);
		border-top: 1px solid var(--border);
		padding-top: 0.9rem;
	}
</style>
