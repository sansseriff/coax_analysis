// Cartridge brass.
//
// The New England Wire N12-42M-100006-1 datasheet specifies C27000 (65/35 Cu/Zn).
// NIST publishes a cryogenic thermal-conductivity fit for C26000 (70/30) only.
// Compositions differ by 5 wt% Zn; thermal conductivities are within ~10% over
// 5–110 K, so we use the C26000 fit as an approximation and flag it here.
//
// Thermal conductivity (W/m·K), NIST fit for UNS C26000:
//   log10(k) = a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵ + g·x⁶ + h·x⁷ + i·x⁸
//   where x = log10(T)
//   Valid 5–110 K, ~1.5% RMS error vs data.
//   Source: https://trc.nist.gov/cryogenics/materials/Brass/Brass_rev.htm
//
// Above 110 K we use a slow-varying extrapolation that anchors at the NIST
// k(110 K) value and linearly drifts toward the well-known room-temperature
// value k(295 K) ≈ 120 W/(m·K) for 65/35 brass.
//
// Below 5 K we use Wiedemann–Franz with the residual electrical resistivity:
//   k(T) = L₀·T / ρ_res,  L₀ = 2.44e-8 W·Ω/K².
// This is appropriate because, unlike polymers, metallic alloys remain
// dominated by electronic conduction down to T → 0.
//
// Electrical resistivity (Ω·m): anchored at two well-published points and
// connected by Matthiessen's rule using the copper Bloch-Grüneisen shape as
// a phonon template (alloys follow the same lattice-scattering temperature
// dependence, just shifted by the alloy residual).
//   ρ(295 K) ≈ 6.2e-8  Ω·m   (Reed & Clark, Materials at Low Temperatures, ASM 1983)
//   ρ(4 K)   ≈ 4.0e-8  Ω·m   (NBS Monograph 31; effectively the residual floor)
// Brass has no useful RRR knob: residual is set by Zn substitutional impurity,
// not by crystalline quality.

import type { Metal } from "./types";

const NIST_BRASS_COEFFS = {
  a:  0.021035,
  b: -1.01835,
  c:  4.54083,
  d: -5.03374,
  e:  3.20536,
  f: -1.12933,
  g:  0.174057,
  h: -0.0038151,
  i:  0,
};

const RHO_BRASS_295 = 6.2e-8; // Ω·m
const RHO_BRASS_RES = 4.0e-8; // Ω·m (residual, ~4 K)
const LORENZ = 2.44e-8;       // W·Ω/K²

function brassKPoly(T: number): number {
  const x = Math.log10(T);
  const p = NIST_BRASS_COEFFS;
  const log10k = p.a + p.b*x + p.c*x**2 + p.d*x**3 + p.e*x**4 + p.f*x**5 + p.g*x**6 + p.h*x**7 + p.i*x**8;
  return Math.pow(10, log10k);
}

const K_BRASS_AT_5K  = brassKPoly(5);
const K_BRASS_AT_110 = brassKPoly(110);
const K_BRASS_AT_295 = 120; // Reed & Clark; widely cited for 65/35

function brassThermalConductivity(T: number): number {
  if (T <= 0) return 0;
  if (T < 5) {
    // Wiedemann–Franz extrapolation anchored at the residual ρ.
    return LORENZ * T / RHO_BRASS_RES;
  }
  if (T <= 110) {
    return brassKPoly(T);
  }
  // Linear blend from k(110 K) to k(295 K) above NIST's valid range.
  const f = (T - 110) / (295 - 110);
  const fc = Math.min(Math.max(f, 0), 1);
  return K_BRASS_AT_110 + (K_BRASS_AT_295 - K_BRASS_AT_110) * fc;
}

function brassResistivity(T: number): number {
  // Matthiessen-style: ρ(T) = ρ_res + ρ_phonon(T).
  // Use the same (T-10)/290 power-law shape as the copper module, but scaled
  // so ρ(295 K) hits the brass value. Below 10 K we sit at the residual.
  if (T <= 10) return RHO_BRASS_RES;
  if (T >= 295) return RHO_BRASS_295;
  const phononRange = RHO_BRASS_295 - RHO_BRASS_RES;
  return RHO_BRASS_RES + phononRange * Math.pow((T - 10) / 285, 1.3);
}

export const BRASS: Metal = {
  name: "Brass C27000 (NIST C26000 fit ±10%)",
  hasRRR: false,
  color: "var(--color-brass)",
  resistivityAt(T) { return brassResistivity(T); },
  thermalConductivityAt(T) { return brassThermalConductivity(T); },
};

// Suppress unused-var lint warning — we keep this constant for clarity.
export const _BRASS_K_AT_5K_REFERENCE = K_BRASS_AT_5K;
