// PFA (perfluoroalkoxy alkanes).
//
// Used by the New England Wire N12-42M-100006-1 as both the inner-conductor
// insulation and the outer jacket.
//
// Thermal conductivity (W/m·K): NIST publishes a polynomial for PTFE (Teflon),
// not PFA specifically. PTFE, FEP, and PFA share the same backbone behaviour
// in the cryogenic range — k differs by <10% across the family — so we use
// the PTFE fit as a proxy.
//   log10(k) = Σ a_n·(log10 T)ⁿ, n=0..8
//   Valid 4–300 K, ~5% accuracy.
//   Source: https://trc.nist.gov/cryogenics/materials/Teflon/Teflon_rev.htm
//
// Below 4 K we extrapolate as k ∝ T² (two-level-system tunneling + Debye
// phonons — the same argument the stripline code uses for Kapton).
//
// Permittivity (ε_r):
//   • 295 K, 1 GHz: ~2.05  (Chemours Teflon™ PFA technical bulletin)
//   • Cryo: literature on PFA at sub-1-K is sparse; for PTFE/FEP the dielectric
//     constant drops by ~3-4% on cooling. We use linear interpolation from
//     ε_r(295 K)=2.05 to ε_r(4 K)=1.97 and clamp below.
//
// Loss tangent (tan δ):
//   • 295 K, 1 GHz: ~3e-4    (Chemours datasheet)
//   • Cryo: tan δ drops rapidly for low-loss fluoropolymers; we model it as
//     log-linear (300 K, 3e-4) → (4 K, 5e-5). Cite as ESTIMATED.

import type { Dielectric } from "./types";
import { teflonKAt } from "./teflon-shared";

export const PFA: Dielectric = {
  name: "PFA (Teflon™ PFA)",
  note: "Cryo ε_r and tan δ are extrapolated from RT datasheet values — flag as estimated.",

  erAt(T: number): number {
    if (T >= 295) return 2.05;
    if (T <= 4) return 1.97;
    return 1.97 + (2.05 - 1.97) * (T - 4) / (295 - 4);
  },

  tanDeltaAt(T: number, _f: number): number {
    const T_hi = 295, tanD_hi = 3e-4;
    const T_lo = 4,   tanD_lo = 5e-5;
    if (T >= T_hi) return tanD_hi;
    if (T <= T_lo) return tanD_lo;
    const r = Math.log(T / T_hi) / Math.log(T_lo / T_hi);
    return tanD_hi * Math.pow(tanD_lo / tanD_hi, r);
  },

  kAt: teflonKAt,
};
