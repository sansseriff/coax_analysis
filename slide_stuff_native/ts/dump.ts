// Emits data/slide-data.json: every value the deck displays, already formatted
// by format.ts, plus the raw geometry the cross-section drawings need.
//
// Python never computes a physical quantity and never rounds a number. If a
// string appears on a slide, it was produced here.
//
//   bun run ts/dump.ts

import { SAMTEC, N12, presetResults, inches, awgToMeters, type CoaxPreset } from './compute';
import { fmt, mm, mils, heatParts, fmtHeat } from './format';

const LENGTHS_IN = [3, 5, 10, 15, 18];
const F_LOW = 2e9;
const F_HIGH = 4e9;
const RF_STAGE = '40to4' as const;
const N_HARNESS = 208;

// `short` is the badge form used in the trade-off line and table headers; the
// full `name` comes off the preset untouched.
const CABLES: Array<{ id: string; preset: CoaxPreset; short: string }> = [
	{ id: 'samtec', preset: SAMTEC, short: 'TCF-3450F' },
	{ id: 'n12', preset: N12, short: 'N12-42M' }
];

/** Ratios read as "6.9×" / "66×" — one decimal only while it still carries information. */
const fmtRatio = (r: number): string => (r >= 10 ? r.toFixed(0) : r.toFixed(1));

/** Geometry the cross-section drawing is built from. All lengths in metres. */
function geometry(p: CoaxPreset) {
	const rInner = awgToMeters(p.innerAwg) / 2;
	const rOuterStrand = awgToMeters(p.outerAwg) / 2;
	const rRing = p.rRing_um * 1e-6;
	const r = presetResults(p, inches(3), F_LOW, RF_STAGE);
	return {
		rInner,
		rOuterStrand,
		rRing,
		nOuter: p.nOuter,
		a: r.a, // dielectric inner radius = 3·rInner
		b: r.b, // dielectric outer radius
		rJacket: rRing + rOuterStrand, // cableOD / 2
		metal: p.metal,
		innerAwg: p.innerAwg,
		outerAwg: p.outerAwg
	};
}

// ── Length-independent per-cable specs (title slide + column subheads) ──
const cables = CABLES.map(({ id, preset, short }) => {
	// Length cancels out of Z₀, OD and α, so any nominal length will do.
	const r = presetResults(preset, inches(3), F_LOW, RF_STAGE);
	return {
		id,
		name: preset.name,
		short,
		description: preset.description,
		z0: fmt(r.Z0, 1),
		odMm: mm(r.cableOD, 2),
		odMils: mils(r.cableOD, 1),
		alpha2: fmt(r.alphaTotal_dBm, 2),
		geom: geometry(preset)
	};
});

// ── Per-length figures ──
const lengths = LENGTHS_IN.map((L) => {
	const lengthM = inches(L);
	const mmWhole = Math.round(lengthM * 1e3);

	const per: Record<string, unknown> = {};
	for (const { id, preset } of CABLES) {
		const lo = presetResults(preset, lengthM, F_LOW, RF_STAGE);
		const hi = presetResults(preset, lengthM, F_HIGH, RF_STAGE);
		const q40 = presetResults(preset, lengthM, F_LOW, '40to4');
		const q41 = presetResults(preset, lengthM, F_LOW, '4to1');
		per[id] = {
			loss2: fmt(lo.totalLoss_dB, 2),
			loss4: fmt(hi.totalLoss_dB, 2),
			q40: heatParts(q40.Qtotal_uW),
			q41: heatParts(q41.Qtotal_uW)
		};
	}

	return {
		inches: L,
		inchLabel: `${L}″`,
		mmLabel: `${mmWhole} mm`,
		title: `${L}″ assembly · ${mmWhole} mm`,
		cables: per
	};
});

// ── Trade-off ratios: length-independent, so evaluate once at a nominal length ──
const nominal = inches(3);
const s = presetResults(SAMTEC, nominal, F_LOW, RF_STAGE);
const n = presetResults(N12, nominal, F_LOW, RF_STAGE);
const tradeoff = {
	lossRatio: fmtRatio(n.totalLoss_dB / s.totalLoss_dB),
	heatRatio: fmtRatio(s.Qtotal_uW / n.Qtotal_uW),
	lossWinner: CABLES[0].short,
	heatWinner: CABLES[1].short
};

// ── Summary table: one row per length, ten data columns ──
//
// Each cell carries `text` (the fmtHeat string, exactly as the spec asks) plus
// the same value split into `v`/`u` so the unit can be set in a smaller, greyer
// run. Both come from the same call — nothing is formatted twice.
const heatCell = (uW: number) => ({ text: fmtHeat(uW), ...heatParts(uW) });

const table = LENGTHS_IN.map((L) => {
	const lengthM = inches(L);
	const cols: Array<{ text: string; v: string; u: string }> = [];
	for (const { preset } of CABLES) {
		const lo = presetResults(preset, lengthM, F_LOW, RF_STAGE);
		const q40 = presetResults(preset, lengthM, F_LOW, '40to4').Qtotal_uW;
		const q41 = presetResults(preset, lengthM, F_LOW, '4to1').Qtotal_uW;
		const loss = fmt(lo.totalLoss_dB, 2);
		cols.push(
			{ text: `${loss} dB`, v: loss, u: 'dB' },
			heatCell(q40),
			heatCell(q41),
			heatCell(q40 * N_HARNESS),
			heatCell(q41 * N_HARNESS)
		);
	}
	return { length: `${L}″`, cols };
});

const out = {
	meta: {
		harness: N_HARNESS,
		harnessLabel: `${N_HARNESS} (13 cables of 16 lines)`,
		fLow: '2 GHz',
		fHigh: '4 GHz',
		lengthsLabel: LENGTHS_IN.map((L) => `${L}″`).join(', '),
		stageRf: '40 K → 4 K',
		stageCold: '4 K → 1 K'
	},
	cables,
	lengths,
	tradeoff,
	table
};

await Bun.write('data/slide-data.json', JSON.stringify(out, null, 2));
console.log(`wrote data/slide-data.json`);
console.log(
	`  trade-off: ${tradeoff.lossWinner} ${tradeoff.lossRatio}× lower loss · ` +
		`${tradeoff.heatWinner} ${tradeoff.heatRatio}× lower heat`
);
for (const c of cables) {
	console.log(`  ${c.name}: Z0=${c.z0} Ω  OD=${c.odMm} mm / ${c.odMils} mils  α=${c.alpha2} dB/m`);
}
