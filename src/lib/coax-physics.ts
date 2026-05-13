// Coaxial-line physics: Z₀, α_c (with stranding penalty), α_d, heat load.
//
// Formula source for the smooth-conductor coax loss:
//   Pozar, Microwave Engineering 4th ed., Sec. 2.7 / eq. (2.93) — the user
//   wrote it in the request as
//     α_c = (1/(2 ln(b/a))) · √(πfμ₀/σ) · (1/a + 1/b) · √(ε_r)/η₀   [Np/m]
//   which simplifies to α_c = (R_s √ε_r / (2 η₀ ln(b/a))) · (1/a + 1/b)
//   where R_s = √(πfμ₀/σ) is surface resistance and η₀ ≈ 376.73 Ω.
//
// Stranded-shield penalty K_s:
//   See plan file for the honest discussion. K_s_default is computed from
//   geometric strand coverage AND the helical lay angle; the UI exposes a
//   slider so the user can override (calibrated against the Samtec TCF-3450F
//   datasheet's measured insertion-loss curve, which is the strongest ground
//   truth available).

import type { Metal, Dielectric } from "./materials";

export const MU_0 = 4 * Math.PI * 1e-7;
export const ETA_0 = 376.730313668;
export const C_0 = 299_792_458;

// ─── Common utilities ───

export function skinDepth(freq: number, rho: number): number {
  return Math.sqrt(rho / (Math.PI * freq * MU_0));
}

/** Surface resistance R_s = √(π·f·μ₀ / σ) = √(π·f·μ₀·ρ). */
export function surfaceResistance(freq: number, rho: number): number {
  return Math.sqrt(Math.PI * freq * MU_0 * rho);
}

/** Composite Simpson's rule (N must be even). */
export function integrateSimpson(fn: (T: number) => number, Tcold: number, Thot: number, N = 200): number {
  const h = (Thot - Tcold) / N;
  if (h <= 0) return 0;
  let sum = fn(Tcold) + fn(Thot);
  for (let j = 1; j < N; j++) {
    sum += (j % 2 === 0 ? 2 : 4) * fn(Tcold + j * h);
  }
  return (h / 3) * sum;
}

// ─── Coax impedance ───

/** Z₀ for an ideal smooth coax with inner-radius a and outer-radius b (metres). */
export function coaxZ0(a: number, b: number, er: number): number {
  if (a <= 0 || b <= a) return NaN;
  return (60 / Math.sqrt(er)) * Math.log(b / a);
}

// ─── Stranding penalty ───

/**
 * Geometric outer-shield strand coverage = N·d / (2π·R), where d = 2·r_strand
 * and R is the radius of the circle the strand centres sit on.
 *   coverage = 1   → strands just touch axially (no gaps).
 *   coverage < 1   → gaps; penalty kicks in.
 *   coverage > 1   → would mean strand overlap (unphysical for a single layer);
 *                    we clamp the penalty to 1 in that regime.
 */
export function shieldCoverage(nStrands: number, rStrand: number, rRing: number): number {
  return (nStrands * rStrand) / (Math.PI * rRing);
}

/**
 * Outer shield stranding penalty (formula default):
 *   K_s_outer = max(1, 1/coverage) · sec(θ_outer).
 *
 * Two mechanisms compose:
 *   • Coverage gap: 1/coverage scales the loss when strands don't tile the
 *     shield circumference.  Sparse shields are very lossy — for N→small the
 *     factor blows up, as it should physically.
 *   • Helical path: sec(θ) accounts for the longer path current follows
 *     along each serve strand vs a straight axial conductor.
 *
 * NOT literature-derived; calibrate the `K_s_outer_correction` multiplier
 * against a measured IL curve (e.g. TCF-3450F datasheet at calRT).
 */
export function outerShieldStrandingPenalty(coverage: number, layAngleRad: number): number {
  const Kcov = coverage >= 1 ? 1 : 1 / coverage;
  return Kcov / Math.cos(layAngleRad);
}

/**
 * Inner 7-strand hex bundle stranding penalty (formula default):
 *   K_s_inner = sec(θ_inner).
 *
 * Justification: the 6 outer strands' outer half-perimeters sum to 6πr,
 * which exactly matches the smooth-cylinder perimeter 2π·(3r) at the
 * bundle envelope.  Geometric coverage of the RF-current-carrying surface
 * is ~95% with only small cusps between adjacent strands — far better
 * than a 36-end serve.  The only first-order penalty is the helical
 * path length on the 6 outer strands; the central strand carries little
 * RF current (it's inside the bundle's skin layer).
 *
 * For bare-strand bundles where current can hop strand-to-strand, even
 * sec(θ) is an upper bound; for enamelled bundles it's tight.  Tune via
 * `K_s_inner_correction`.
 */
export function innerBundleStrandingPenalty(layAngleRad: number): number {
  return 1 / Math.cos(layAngleRad);
}

/** @deprecated Kept as alias for the outer-shield formula. */
export const defaultStrandingPenalty = outerShieldStrandingPenalty;

// ─── RF loss ───

/**
 * Smooth-coax conductor loss in dB/m. a, b in metres; rho in Ω·m.
 * Pozar Sec 2.7 (Microwave Engineering, 4th ed.).
 */
export function coaxConductorLossSmooth(
  a: number, b: number, er: number, freq: number, rho: number,
): number {
  const Rs = surfaceResistance(freq, rho);
  const alphaNp = (Rs * Math.sqrt(er) / (2 * ETA_0 * Math.log(b / a))) * (1 / a + 1 / b);
  return alphaNp * 8.686;
}

/**
 * Per-side smooth-coax conductor loss in dB/m, parameterised on R_s directly.
 *
 * The Pozar formula's (1/a + 1/b) is additive — inner and outer
 * contributions are independent.  Returning them separately lets the caller
 * apply different stranding penalties to each conductor.  Taking R_s instead
 * of ρ also lets the caller supply a layered/effective R_s (e.g. SPC) where
 * the simple √(πfμ₀·ρ) form would be wrong.
 */
export function coaxConductorLossPerSideFromRs(
  a: number, b: number, er: number, Rs: number,
): { alpha_inner_dBm: number; alpha_outer_dBm: number } {
  const common = (Rs * Math.sqrt(er)) / (2 * ETA_0 * Math.log(b / a));
  return {
    alpha_inner_dBm: common * (1 / a) * 8.686,
    alpha_outer_dBm: common * (1 / b) * 8.686,
  };
}

/** Convenience wrapper: per-side loss starting from bulk ρ. */
export function coaxConductorLossPerSide(
  a: number, b: number, er: number, freq: number, rho: number,
): { alpha_inner_dBm: number; alpha_outer_dBm: number } {
  return coaxConductorLossPerSideFromRs(a, b, er, surfaceResistance(freq, rho));
}

/** Dielectric loss in dB/m. */
export function coaxDielectricLoss(freq: number, er: number, tanD: number): number {
  return (Math.PI * Math.sqrt(er) * tanD * freq / C_0) * 8.686;
}

// ─── High-level design entry point ───

// "calRT" = calibration mode: evaluate everything at 295 K (room temperature),
// matching the conditions under which vendor IL curves are measured. Heat-load
// integrals collapse to zero because Tcold == Thot, which is the right answer:
// there is no thermal gradient to integrate. RF loss is the value to compare
// against the datasheet for tuning K_s.
export type Stage = "40to4" | "4to1" | "calRT";

export interface CoaxInputs {
  /** Inner-strand radius (m). */
  rInner: number;
  /** Outer-strand radius (m). */
  rOuterStrand: number;
  /** Radius (m) of the circle on which outer-strand centres sit. Tunable. */
  rRing: number;
  /** Number of outer-shield strands. Tunable. */
  nOuter: number;
  /** Lay angle of inner 7-strand bundle (radians). */
  layInner: number;
  /** Lay angle of outer shield serve/braid (radians). */
  layOuter: number;
  /** Cable length (m). */
  length: number;
  /** Frequency (Hz). */
  freq: number;
  /** Temperature stage. */
  stage: Stage;
  /** Conductor metal (applied to inner AND outer strands). */
  metal: Metal;
  /** Optional RRR for metals that support it. */
  rrr?: number;
  /** Dielectric. */
  dielectric: Dielectric;
  /**
   * Multiplicative correction on top of the inner-bundle K_s formula.
   * Default 1.  Use the datasheet-calibration knob in the UI to set this.
   */
  K_s_inner_correction?: number;
  /**
   * Multiplicative correction on top of the outer-shield K_s formula.
   * Default 1.  Calibration against a measured IL curve typically lands
   * this in the 1.5–3× range for serve/spiral shields.
   */
  K_s_outer_correction?: number;
}

export interface CoaxResults {
  // geometry (metres)
  a: number;                 // dielectric inner radius = 3·r_inner
  b: number;                 // dielectric outer radius = rRing - rOuterStrand
  cableOD: number;           // 2·(rRing + rOuterStrand)
  // strand
  coverage: number;                // geometric outer-shield coverage
  K_s_inner_formula: number;       // formula default for inner bundle
  K_s_outer_formula: number;       // formula default for outer shield
  K_s_inner: number;               // formula × correction (actual value used)
  K_s_outer: number;               // formula × correction (actual value used)
  // electrical
  Z0: number;                // Ω
  rhoMetal: number;          // Ω·m at T_avg
  rhoMetalRT: number;        // Ω·m at 295 K (for reference comparison)
  skinDepth_um: number;
  Rs: number;                // surface resistance Ω
  // RF loss
  alphaCond_inner_dBm: number;     // inner-conductor contribution (stranded)
  alphaCond_outer_dBm: number;     // outer-conductor contribution (stranded)
  alphaCond_dBm: number;           // total = inner + outer
  alphaDiel_dBm: number;           // at T_avg
  alphaTotal_dBm: number;
  totalLoss_dB: number;
  totalLossRT_dB: number;    // same cable, room-temp ρ — reference
  // thermal
  Tavg: number;
  Tcold: number;
  Thot: number;
  Qinner_uW: number;
  Qouter_uW: number;
  Qdiel_uW: number;
  Qtotal_uW: number;
  // dielectric snapshot
  er: number;
  tanD: number;
}

export function computeCoax(inp: CoaxInputs): CoaxResults {
  // 1. Geometry
  const a = 3 * inp.rInner;
  const b = inp.rRing - inp.rOuterStrand;
  const cableOD = 2 * (inp.rRing + inp.rOuterStrand);

  // 2. Stranding penalty (per-side; see comments at the formulas above)
  const coverage = shieldCoverage(inp.nOuter, inp.rOuterStrand, inp.rRing);
  const K_s_inner_formula = innerBundleStrandingPenalty(inp.layInner);
  const K_s_outer_formula = outerShieldStrandingPenalty(coverage, inp.layOuter);
  const K_s_inner = K_s_inner_formula * (inp.K_s_inner_correction ?? 1);
  const K_s_outer = K_s_outer_formula * (inp.K_s_outer_correction ?? 1);

  // 3. Temperatures
  let Thot: number, Tcold: number;
  if (inp.stage === "40to4")      { Thot = 40;  Tcold = 4; }
  else if (inp.stage === "4to1")  { Thot = 4;   Tcold = 1; }
  else                            { Thot = 295; Tcold = 295; }  // calRT
  const Tavg  = (Thot + Tcold) / 2;

  // 4. Material properties at T_avg
  const rho = inp.metal.resistivityAt(Tavg, inp.rrr);
  const er  = inp.dielectric.erAt(Tavg);
  const tanD = inp.dielectric.tanDeltaAt(Tavg, inp.freq);

  // 5. Z0, skin depth, and surface resistance.
  //   skinDepth is reported in the breakdown for the conductor surface, so
  //   for layered metals (SPC) it correctly reflects the *plating's* skin
  //   depth — that's what controls whether RF current sees the substrate.
  //   For the loss calculation we prefer metal.surfaceResistanceAt() when
  //   defined (handles plating); otherwise we fall back to the bulk form.
  const Z0 = coaxZ0(a, b, er);
  const Rs = inp.metal.surfaceResistanceAt
    ? inp.metal.surfaceResistanceAt(inp.freq, Tavg, inp.rrr)
    : surfaceResistance(inp.freq, rho);
  const delta = skinDepth(inp.freq, rho);

  // 6. RF loss at T_avg — split inner/outer Pozar terms so each conductor
  // gets its own K_s, then recombine.
  const perSide = coaxConductorLossPerSideFromRs(a, b, er, Rs);
  const alphaCond_inner = K_s_inner * perSide.alpha_inner_dBm;
  const alphaCond_outer = K_s_outer * perSide.alpha_outer_dBm;
  const alphaCond = alphaCond_inner + alphaCond_outer;
  const alphaDiel = coaxDielectricLoss(inp.freq, er, tanD);
  const alphaTotal = alphaCond + alphaDiel;
  const totalLoss = alphaTotal * inp.length;

  // 7. Room-temperature reference
  const rhoRT = inp.metal.resistivityAt(295, inp.rrr);
  const erRT  = inp.dielectric.erAt(295);
  const tanDRT = inp.dielectric.tanDeltaAt(295, inp.freq);
  const RsRT = inp.metal.surfaceResistanceAt
    ? inp.metal.surfaceResistanceAt(inp.freq, 295, inp.rrr)
    : surfaceResistance(inp.freq, rhoRT);
  const perSideRT = coaxConductorLossPerSideFromRs(a, b, erRT, RsRT);
  const alphaCondRT = K_s_inner * perSideRT.alpha_inner_dBm
                    + K_s_outer * perSideRT.alpha_outer_dBm;
  const alphaDielRT = coaxDielectricLoss(inp.freq, erRT, tanDRT);
  const totalLossRT = (alphaCondRT + alphaDielRT) * inp.length;

  // 8. Heat load with lay-angle corrections
  const Astrand_in = Math.PI * inp.rInner ** 2;
  const Aouter = inp.nOuter * Math.PI * inp.rOuterStrand ** 2;
  const Adiel  = Math.PI * (b * b - a * a);

  const metalIntegral = integrateSimpson(
    (T) => inp.metal.thermalConductivityAt(T, inp.rrr),
    Tcold, Thot,
  );
  const dielIntegral = integrateSimpson(
    (T) => inp.dielectric.kAt(T),
    Tcold, Thot,
  );

  // Heat conducted along a helical strand of axial length L is
  // Q_helix = k·A·cos(θ)·ΔT_integral / L_axial.
  // Inner 7-strand bundle: the central strand is straight (cos = 1); only the
  // six petal strands lay at angle θ.  Total cos-weighted strand count =
  // 1 + 6·cos(θ_inner).
  const innerCosWeighted = 1 + 6 * Math.cos(inp.layInner);
  const Qinner = (Astrand_in * innerCosWeighted / inp.length) * metalIntegral;
  const Qouter = (Aouter * Math.cos(inp.layOuter) / inp.length) * metalIntegral;
  const Qdiel  = (Adiel / inp.length) * dielIntegral;
  const Qtotal = Qinner + Qouter + Qdiel;

  return {
    a, b, cableOD,
    coverage,
    K_s_inner_formula, K_s_outer_formula,
    K_s_inner, K_s_outer,
    Z0,
    rhoMetal: rho, rhoMetalRT: rhoRT,
    skinDepth_um: delta * 1e6,
    Rs,
    alphaCond_inner_dBm: alphaCond_inner,
    alphaCond_outer_dBm: alphaCond_outer,
    alphaCond_dBm: alphaCond,
    alphaDiel_dBm: alphaDiel,
    alphaTotal_dBm: alphaTotal,
    totalLoss_dB: totalLoss,
    totalLossRT_dB: totalLossRT,
    Tavg, Tcold, Thot,
    Qinner_uW: Qinner * 1e6,
    Qouter_uW: Qouter * 1e6,
    Qdiel_uW: Qdiel * 1e6,
    Qtotal_uW: Qtotal * 1e6,
    er, tanD,
  };
}
