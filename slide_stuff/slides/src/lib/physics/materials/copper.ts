// OFHC copper — ported verbatim from the stripline calculator's audited
// physics module at ../../../src/lib/physics.ts (lines 12-31, 56-61).
//
// Sources:
//   • NIST OFHC Copper, thermal conductivity polynomial:
//     https://trc.nist.gov/cryogenics/materials/OFHC%20Copper/OFHC_Copper_rev1.htm
//     Form: log10(k) = (a + c√T + eT + gT^1.5 + iT²) / (1 + b√T + dT + fT^1.5 + hT²)
//     Valid 4–300 K, ~1–2% accuracy.
//   • Resistivity: Bloch-Grüneisen-shaped power-law fit with residual
//     ρ_res = ρ_300K / RRR. ρ_300K = 1.68e-8 Ω·m.
//
// For silver-plated copper (SPC) — used by the Samtec TCF-3450F on both inner
// strands and outer shield — see ./spc.ts, which composes COPPER (substrate)
// with SILVER (1 µm plating) using a layered surface-impedance model.

import type { Metal } from "./types";

const RHO_CU_300 = 1.68e-8; // Ω·m

export const RRR_OPTIONS = [50, 100, 150, 300, 500] as const;
export type RRR = (typeof RRR_OPTIONS)[number];

const NIST_CU_COEFFS: Record<RRR, { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number; i: number }> = {
  50:  { a:  1.8743,  b: -0.41538, c: -0.6018,  d:  0.13294, e:  0.26426, f: -0.02190,  g: -0.051276, h:  0.0014871, i:  0.003723  },
  100: { a:  2.2154,  b: -0.47461, c: -0.88068, d:  0.13871, e:  0.29505, f: -0.02043,  g: -0.04831,  h:  0.001281,  i:  0.003207  },
  150: { a:  2.3797,  b: -0.4918,  c: -0.98615, d:  0.13942, e:  0.30475, f: -0.019713, g: -0.046897, h:  0.0011969, i:  0.0029988 },
  300: { a:  1.357,   b:  0.3981,  c:  2.669,   d: -0.1346,  e: -0.6683,  f:  0.01342,  g:  0.05773,  h:  0.0002147, i:  0        },
  500: { a:  2.8075,  b: -0.54074, c: -1.2777,  d:  0.15362, e:  0.36444, f: -0.02105,  g: -0.051727, h:  0.0012226, i:  0.0030964 },
};

function isRRR(r: number | undefined): r is RRR {
  return r !== undefined && (RRR_OPTIONS as readonly number[]).includes(r);
}

function pickRRR(r: number | undefined): RRR {
  return isRRR(r) ? r : 50;
}

function cuThermalConductivity(T: number, rrr: RRR): number {
  if (T <= 0) return 0;
  const p = NIST_CU_COEFFS[rrr];
  const sqrtT = Math.sqrt(T);
  const num = p.a + p.c * sqrtT + p.e * T + p.g * T * sqrtT + p.i * T * T;
  const den = 1   + p.b * sqrtT + p.d * T + p.f * T * sqrtT + p.h * T * T;
  return Math.pow(10, num / den);
}

function cuResistivity(T: number, rrr: RRR): number {
  const rhoResidual = RHO_CU_300 / rrr;
  if (T <= 10) return rhoResidual;
  if (T >= 300) return RHO_CU_300;
  return rhoResidual + (RHO_CU_300 - rhoResidual) * Math.pow((T - 10) / 290, 1.3);
}

export const COPPER: Metal = {
  name: "Copper (OFHC)",
  hasRRR: true,
  color: "var(--color-copper)",
  resistivityAt(T, rrr) { return cuResistivity(T, pickRRR(rrr)); },
  thermalConductivityAt(T, rrr) { return cuThermalConductivity(T, pickRRR(rrr)); },
};
