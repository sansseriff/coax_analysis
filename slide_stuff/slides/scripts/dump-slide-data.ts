// Dump every number the deck displays to ../output/slide-data.json.
//
// This is the bridge for the Python/pptx build: rather than re-implementing the
// coax model (and its formatting rules) in Python, we call the *same*
// TypeScript physics library the Svelte deck calls, and emit the already
// formatted display strings. Python then does pure layout.
//
// Usage:  bun scripts/dump-slide-data.ts

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import {
	SAMTEC,
	N12,
	N12_DOUBLED,
	N12_TRIPLED,
	presetResults,
	inches,
	type CoaxPreset,
	type Stage
} from '../src/lib/compute';
import { fmt, mm, mils, heatParts, fmtHeat } from '../src/lib/format';
import { awgToMeters } from '../src/lib/physics/awg';

const SLIDES_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.resolve(SLIDES_DIR, '..', 'output', 'slide-data.json');

const F_LOW = 2e9;
const F_HIGH = 4e9;
const LENGTHS = [3, 5, 10, 15, 18];
const BUNDLE = 208; // full harness: 13 × 16 cables

// Radius-scaling appendix: {2×, ≈3×} × {5″, 10″} × {both stages}.
const SCALED_VARIANTS = [N12_DOUBLED, N12_TRIPLED];
const SCALED_LENGTHS = [5, 10];
const SCALED_STAGES: Stage[] = ['40to4', '4to1'];
const STAGE_LABEL: Record<string, string> = {
	'40to4': '40 K → 4 K',
	'4to1': '4 K → 1 K',
	calRT: '295 K'
};

/** Circle geometry for CableCrossSection.svelte, in metres. */
function crossSection(p: CoaxPreset) {
	const rInner = awgToMeters(p.innerAwg) / 2;
	const rOuterStrand = awgToMeters(p.outerAwg) / 2;
	const rRing = p.rRing_um * 1e-6;
	const padFrac = 0.04;
	return {
		rInner,
		rOuterStrand,
		rRing,
		nOuter: p.nOuter,
		a: 3 * rInner, // dielectric inner radius = bundle envelope
		halfBox: (rRing + rOuterStrand) * (1 + padFrac),
		metal: p.metal === 'brass' ? 'brass' : 'copper'
	};
}

/** Length-independent header spec (slide 0 + card heads). */
function spec(p: CoaxPreset) {
	const r = presetResults(p, inches(1), F_LOW, '40to4');
	return {
		key: p.key,
		name: p.name,
		description: p.description,
		z0: fmt(r.Z0, 1),
		odMm: mm(r.cableOD),
		odMils: mils(r.cableOD),
		alpha: fmt(r.alphaTotal_dBm, 2), // dB/m at 2 GHz, 22 K
		crossSection: crossSection(p)
	};
}

/** One card column on a length slide — mirrors LengthSlide.buildCol(). */
function col(p: CoaxPreset, lengthIn: number) {
	const L = inches(lengthIn);
	const hi = presetResults(p, L, F_LOW, '40to4');
	const il4 = presetResults(p, L, F_HIGH, '40to4').totalLoss_dB;
	const lo = presetResults(p, L, F_LOW, '4to1');
	return {
		...spec(p),
		il2: fmt(hi.totalLoss_dB, 2),
		il4: fmt(il4, 2),
		heatHi: heatParts(hi.Qtotal_uW),
		heatLo: heatParts(lo.Qtotal_uW),
		_il2raw: hi.totalLoss_dB,
		_heatHiRaw: hi.Qtotal_uW
	};
}

function lengthSlide(lengthIn: number) {
	const cols = [col(SAMTEC, lengthIn), col(N12, lengthIn)];
	return {
		lengthIn,
		mmIn: (lengthIn * 25.4).toFixed(0),
		cols: cols.map(({ _il2raw, _heatHiRaw, ...c }) => c),
		// Trade-off framing: each side expressed as a "× lower" advantage.
		lossAdvTCF: fmt(cols[1]._il2raw / cols[0]._il2raw, 1),
		heatAdvN12: fmt(cols[0]._heatHiRaw / cols[1]._heatHiRaw, 0)
	};
}

/** One card on a radius-scaling slide — mirrors ScaledSlide.buildCol(). */
function scaledCol(p: CoaxPreset, lengthIn: number, stage: Stage) {
	const L = inches(lengthIn);
	const r = presetResults(p, L, F_LOW, stage);
	return {
		...spec(p),
		heat: heatParts(r.Qtotal_uW),
		heatBundle: fmtHeat(r.Qtotal_uW * BUNDLE),
		il2: fmt(r.totalLoss_dB, 2),
		il4: fmt(presetResults(p, L, F_HIGH, stage).totalLoss_dB, 2),
		_heatRaw: r.Qtotal_uW,
		_il2raw: r.totalLoss_dB,
		_odRaw: r.cableOD
	};
}

/** Radius-scaling slide — mirrors ScaledSlide.svelte. */
function scaledSlide(variant: CoaxPreset, lengthIn: number, stage: Stage) {
	const cols = [scaledCol(N12, lengthIn, stage), scaledCol(variant, lengthIn, stage)];
	return {
		variant: variant.key,
		lengthIn,
		mmIn: (lengthIn * 25.4).toFixed(0),
		stage,
		stageLabel: STAGE_LABEL[stage],
		cols: cols.map(({ _heatRaw, _il2raw, _odRaw, ...c }) => c),
		heatMult: fmt(cols[1]._heatRaw / cols[0]._heatRaw, 1),
		lossAdv: fmt(cols[0]._il2raw / cols[1]._il2raw, 1),
		odMult: fmt(cols[1]._odRaw / cols[0]._odRaw, 2)
	};
}

/** Summary-table row — mirrors slide_6's row(). */
function summaryRow(lengthIn: number) {
	const L = inches(lengthIn);
	const cell = (p: CoaxPreset) => {
		const hi = presetResults(p, L, F_LOW, '40to4');
		const lo = presetResults(p, L, F_LOW, '4to1');
		return {
			il: `${fmt(hi.totalLoss_dB, 2)} dB`,
			qHi: fmtHeat(hi.Qtotal_uW),
			qLo: fmtHeat(lo.Qtotal_uW),
			qHiBundle: fmtHeat(hi.Qtotal_uW * BUNDLE),
			qLoBundle: fmtHeat(lo.Qtotal_uW * BUNDLE)
		};
	};
	return { length: `${lengthIn}″`, samtec: cell(SAMTEC), n12: cell(N12) };
}

const data = {
	deckTitle: 'Cryogenic Micro-Coax · Loss & Heat-Load Projections',
	bundle: BUNDLE,
	title: {
		kicker: '50 Ω stranded micro-coax · cryostat wiring',
		heading: 'Insertion Loss & Heat-Load Projections',
		lede: {
			pre: 'Hard numbers for RF insertion loss and conducted heat load of two candidate micro-coax cables, at assembly lengths of ',
			bold: '3″, 5″, 10″, 15″ and 18″',
			post: '.'
		},
		cards: [spec(SAMTEC), spec(N12)],
		notes:
			'RF model: Pozar conductor loss + dielectric loss, with per-conductor stranding factor K_s calibrated to the TCF-3450F insertion-loss curve (1–4 GHz). Heat load: steady-state conduction across each cryostat stage’s ΔT, with lay-angle path corrections. Use ← → to navigate.'
	},
	lengthSlides: LENGTHS.map(lengthSlide),
	lengthFooter:
		"RF insertion loss = total α(f)·L at the 4–40 K stage (T̄ ≈ 22 K), conductor + dielectric. Heat load = steady-state conduction Q̇ across each stage's ΔT, per cable. Model: Pozar α_c with per-conductor stranding factor K_s (calibrated to the TCF-3450F IL curve, 1–4 GHz). Both cables 50 Ω.",
	// In deck order: slide_7 … slide_14.
	scaledSlides: SCALED_VARIANTS.flatMap((v) =>
		SCALED_LENGTHS.flatMap((len) => SCALED_STAGES.map((st) => scaledSlide(v, len, st)))
	),
	summary: {
		eyebrow: 'Summary',
		title: 'All lengths at a glance',
		samtecName: SAMTEC.name,
		n12Name: N12.name,
		bundleHeader: `${BUNDLE} (13 cables of 16 lines)`,
		rows: LENGTHS.map(summaryRow),
		footer:
			"Insertion loss quoted at 2 GHz, 4–40 K stage. Heat load is conducted Q̇ across each stage's ΔT — shown per cable and for the full 208-cable harness (13 × 16). See per-length slides for 4 GHz figures and inner/outer/dielectric breakdowns."
	}
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
