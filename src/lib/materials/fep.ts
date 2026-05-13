// FEP (fluorinated ethylene propylene) — solid and cellular ("foam").
//
// Used by the Samtec TCF-3450F as a foamed dielectric. The TCF-3450F datasheet
// reports an inner-conductor bundle Ø 0.0075" and dielectric OD Ø 0.0190" at
// 50 Ω. Plug into Z₀ = (60/√ε_r)·ln(b/a):
//   ln(0.0190/0.0075) / (50·√ε_r / 60) = 50 / 60 → √ε_r = (60/50)·ln(2.533)/1
//   → ε_r ≈ 1.49 — consistent with ~40% foaming of solid FEP.
//
// Thermal conductivity: same PTFE/Teflon NIST fit as PFA (shared module).
// For foam, k scales roughly linearly with solid fraction (Maxwell-Eucken
// lower bound is fine here since foam_solid_fraction is small).
//
// Solid-FEP electrical properties (Chemours FEP technical bulletin):
//   ε_r ≈ 2.05 at 295 K, 1 GHz
//   tan δ ≈ 7e-4 at 295 K, 1 GHz
//
// Foam mixing (Wiener lower bound; reasonable for axial-aligned foam cells):
//   ε_r_foam = 1 + (ε_r_solid - 1) · solidFrac
//   tanδ_foam = tanδ_solid · solidFrac
// where solidFrac = 1 - foamFraction (0 = solid FEP; 0.6 ≈ heavily foamed).

import type { Dielectric } from "./types";
import { teflonKAt } from "./teflon-shared";

const FEP_SOLID_ER_295 = 2.05;
const FEP_SOLID_ER_4   = 1.97;
const FEP_SOLID_TAND_295 = 7e-4;
const FEP_SOLID_TAND_4   = 1e-4;

function fepSolidEr(T: number): number {
  if (T >= 295) return FEP_SOLID_ER_295;
  if (T <= 4)   return FEP_SOLID_ER_4;
  return FEP_SOLID_ER_4 + (FEP_SOLID_ER_295 - FEP_SOLID_ER_4) * (T - 4) / (295 - 4);
}

function fepSolidTanD(T: number): number {
  if (T >= 295) return FEP_SOLID_TAND_295;
  if (T <= 4)   return FEP_SOLID_TAND_4;
  const r = Math.log(T / 295) / Math.log(4 / 295);
  return FEP_SOLID_TAND_295 * Math.pow(FEP_SOLID_TAND_4 / FEP_SOLID_TAND_295, r);
}

export const FEP_SOLID: Dielectric = {
  name: "FEP (solid)",
  note: "Cryo ε_r and tan δ are extrapolated from RT datasheet values — flag as estimated.",
  erAt: fepSolidEr,
  tanDeltaAt(T, _f) { return fepSolidTanD(T); },
  kAt: teflonKAt,
};

/**
 * FEP foam with a tunable foamFraction (0..0.8). 0.45 ≈ TCF-3450F.
 * Returns a Dielectric implementation parameterized by the foam density.
 */
export function makeFepFoam(foamFraction: number): Dielectric {
  const solidFrac = Math.max(0, Math.min(1, 1 - foamFraction));
  return {
    name: `FEP foam (${(foamFraction * 100).toFixed(0)}% air)`,
    note: "Cryo properties estimated; foam mixing via Wiener lower bound.",
    erAt(T) {
      const erSolid = fepSolidEr(T);
      return 1 + (erSolid - 1) * solidFrac;
    },
    tanDeltaAt(T, _f) {
      return fepSolidTanD(T) * solidFrac;
    },
    kAt(T) {
      return teflonKAt(T) * solidFrac;
    },
  };
}
