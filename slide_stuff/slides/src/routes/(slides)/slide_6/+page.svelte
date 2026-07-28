<script lang="ts">
	import Slide from '$lib/Slide.svelte';
	import { SAMTEC, N12, presetResults, inches, type CoaxPreset } from '$lib/compute';
	import { fmt, fmtHeat } from '$lib/format';

	const LENGTHS = [3, 5, 10, 15, 18];
	const BUNDLE = 208; // full harness: 13 × 16 cables

	function row(lengthIn: number) {
		const L = inches(lengthIn);
		const cell = (p: CoaxPreset) => {
			const hi = presetResults(p, L, 2e9, '40to4');
			const lo = presetResults(p, L, 2e9, '4to1');
			return {
				il: `${fmt(hi.totalLoss_dB, 2)} dB`,
				qHi: fmtHeat(hi.Qtotal_uW),
				qLo: fmtHeat(lo.Qtotal_uW),
				qHiBundle: fmtHeat(hi.Qtotal_uW * BUNDLE),
				qLoBundle: fmtHeat(lo.Qtotal_uW * BUNDLE)
			};
		};
		return { lengthIn, samtec: cell(SAMTEC), n12: cell(N12) };
	}

	const rows = LENGTHS.map(row);
</script>

<Slide
	eyebrow="Summary"
	title="All lengths at a glance"
	footer="Insertion loss quoted at 2 GHz, 4–40 K stage. Heat load is conducted Q̇ across each stage's ΔT — shown per cable and for the full 208-cable harness (13 × 16). See per-length slides for 4 GHz figures and inner/outer/dielectric breakdowns."
>
	<div class="table-wrap">
		<table>
			<thead>
				<tr class="grp">
					<th class="corner" rowspan="3">Length</th>
					<th colspan="5" class="g-samtec">{SAMTEC.name}</th>
					<th colspan="5" class="g-n12">{N12.name}</th>
				</tr>
				<tr class="subgrp">
					<th rowspan="2" class="loss-h">Loss<span>2 GHz</span></th>
					<th colspan="2">Q̇ per cable</th>
					<th colspan="2" class="bundle-h">208 (13 cables of 16 lines)</th>
					<th rowspan="2" class="loss-h sep">Loss<span>2 GHz</span></th>
					<th colspan="2">Q̇ per cable</th>
					<th colspan="2" class="bundle-h">208 (13 cables of 16 lines)</th>
				</tr>
				<tr class="sub">
					<th>40→4 K</th>
					<th>4→1 K</th>
					<th class="bundle-h">40→4 K</th>
					<th class="bundle-h">4→1 K</th>
					<th class="sep">40→4 K</th>
					<th>4→1 K</th>
					<th class="bundle-h">40→4 K</th>
					<th class="bundle-h">4→1 K</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.lengthIn)}
					<tr>
						<th class="len mono">{r.lengthIn}″</th>
						<td class="mono">{r.samtec.il}</td>
						<td class="mono">{r.samtec.qHi}</td>
						<td class="mono dim">{r.samtec.qLo}</td>
						<td class="mono bundle">{r.samtec.qHiBundle}</td>
						<td class="mono bundle dim">{r.samtec.qLoBundle}</td>
						<td class="mono sep">{r.n12.il}</td>
						<td class="mono">{r.n12.qHi}</td>
						<td class="mono dim">{r.n12.qLo}</td>
						<td class="mono bundle">{r.n12.qHiBundle}</td>
						<td class="mono bundle dim">{r.n12.qLoBundle}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Slide>

<style>
	.table-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	table {
		width: 100%;
		max-width: 1120px;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	thead .grp th {
		padding: 0.4rem 0.6rem 0.6rem;
		font-size: 0.92rem;
		font-weight: 700;
		text-align: center;
	}
	.g-samtec {
		color: var(--accent);
		border-bottom: 2px solid var(--accent-line);
	}
	.g-n12 {
		color: var(--accent2);
		border-bottom: 2px solid var(--accent2-line);
	}
	.corner {
		text-align: left;
		color: var(--text-muted);
		font-weight: 600;
		vertical-align: bottom;
	}

	thead .subgrp th {
		padding: 0.4rem 0.6rem;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		text-align: center;
	}
	thead .subgrp .loss-h {
		text-align: right;
		color: var(--text-secondary);
		vertical-align: bottom;
	}
	thead .subgrp .loss-h span {
		display: block;
		font-weight: 400;
		font-size: 0.6rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--text-muted);
		margin-top: 0.1rem;
	}

	thead .sub th {
		padding: 0.45rem 0.6rem;
		font-size: 0.64rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-secondary);
		text-align: right;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	thead .subgrp .bundle-h,
	thead .sub .bundle-h {
		background: var(--surface);
		color: var(--text-secondary);
	}

	tbody td,
	tbody th {
		padding: 0.6rem 0.6rem;
		text-align: right;
		border-bottom: 1px solid var(--border);
		color: var(--text-primary);
		white-space: nowrap;
	}
	tbody tr:last-child td,
	tbody tr:last-child th {
		border-bottom: none;
	}
	.len {
		text-align: left;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.dim {
		color: var(--text-muted);
	}
	.bundle {
		font-weight: 600;
		background: var(--surface);
	}
	.sep {
		border-left: 1px solid var(--border);
	}
	tbody tr:hover td,
	tbody tr:hover th {
		background: var(--surface);
	}
</style>
