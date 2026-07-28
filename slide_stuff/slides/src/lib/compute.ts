// Bridge between the slide deck and the coax-analysis physics library.
//
// The physics is vendored under ./physics (copied verbatim from the main
// calculator app's src/lib). This wraps the preset → CoaxInputs derivation that
// CoaxCalculator.svelte does internally, exposing one helper the slides call so
// the numbers shown on slides match the interactive calculator exactly.

import { computeCoax, type Stage, type CoaxResults } from './physics/coax-physics';
import { PRESETS, type CoaxPreset } from './physics/presets';
import { METALS, PFA, FEP_SOLID, makeFepFoam, type Dielectric } from './physics/materials';
import { awgToMeters } from './physics/awg';

export { PRESETS };
export type { CoaxPreset, CoaxResults, Stage };

export const INCH_M = 0.0254;

/** Convert a length in inches to metres. */
export const inches = (n: number): number => n * INCH_M;

/**
 * Evaluate the full coax model for a preset at a given length, frequency and
 * thermal stage. Mirrors the derived-state wiring in CoaxCalculator.svelte so
 * the numbers shown on slides match the interactive calculator exactly.
 */
export function presetResults(
	p: CoaxPreset,
	lengthM: number,
	freqHz: number,
	stage: Stage
): CoaxResults {
	const metal = METALS[p.metal];
	const dielectric: Dielectric =
		p.dielectric === 'pfa'
			? PFA
			: p.dielectric === 'fepSolid'
				? FEP_SOLID
				: makeFepFoam(p.foamFraction ?? 0.45);

	return computeCoax({
		rInner: awgToMeters(p.innerAwg) / 2,
		rOuterStrand: awgToMeters(p.outerAwg) / 2,
		rRing: p.rRing_um * 1e-6,
		nOuter: p.nOuter,
		layInner: (p.layInner_deg * Math.PI) / 180,
		layOuter: (p.layOuter_deg * Math.PI) / 180,
		length: lengthM,
		freq: freqHz,
		stage,
		metal,
		rrr: metal.hasRRR ? (p.rrr ?? 50) : undefined,
		dielectric,
		K_s_inner_correction: p.K_s_inner_correction,
		K_s_outer_correction: p.K_s_outer_correction
	});
}

/** The two cables this deck compares, in display order. */
export const SAMTEC = PRESETS.samtec_tcf3450f;
export const N12 = PRESETS.new_n12_42m;

/** Hypothetical scaled-up N12 variants (see presets.ts for how they're sized). */
export const N12_DOUBLED = PRESETS.new_doubled;
export const N12_TRIPLED = PRESETS.new_tripled;
