// SPC — silver-plated copper. 1 µm of silver electroplated onto an OFHC
// substrate. Used by the Samtec TCF-3450F on both inner-bundle strands and
// outer-shield strands.
//
// The interesting physics: at room temperature 2 GHz, the silver skin depth
// is ~1.4 µm — comparable to the 1 µm plating — so RF current "leaks" into
// the copper substrate and the cable sees a blend of the two metals. At
// cryogenic temperatures with high-RRR copper, the substrate's skin depth
// shrinks to ~0.2 µm but the plating itself is still ~1 µm, so the current
// is forced to flow in the much-lossier electroplated silver layer. This is
// the opposite of intuition: SPC can be *worse* than bare OFHC at cryo.
//
// We capture this with the standard two-layer surface-impedance formula
// (e.g. Ramo/Whinnery/Van Duzer, "Fields and Waves in Communication
// Electronics", §3.16; Pozar exercise 2.27):
//
//   Z_in = η_p · (η_s + η_p·tanh(γ_p·t)) / (η_p + η_s·tanh(γ_p·t))
//
// where t is the plating thickness, η = (1+j)·R_s the intrinsic impedance,
// γ = (1+j)/δ the propagation constant in each layer, and the substrate is
// treated as semi-infinite (skin depth in copper << remaining strand radius,
// always true here). R_s_eff = Re(Z_in).
//
// For thermal conduction we use plain copper: the plating is ~1 µm thick on
// strands of radius 20–30 µm — a few-percent volume fraction. Silver and
// copper k are within 10% at all relevant T, so this is a sub-percent error.

import type { Metal } from "./types";
import { COPPER } from "./copper";
import { SILVER } from "./silver";

const MU_0 = 4 * Math.PI * 1e-7;
const T_PLATING_M = 1e-6; // 1 µm

/** Effective surface resistance Re(Z_in) for a plating of thickness t over
 *  a semi-infinite substrate. All inputs in SI. */
function layeredSurfaceResistance(
  freq: number, t: number, rho_plating: number, rho_substrate: number,
): number {
  const Rs_p = Math.sqrt(Math.PI * freq * MU_0 * rho_plating);
  const Rs_s = Math.sqrt(Math.PI * freq * MU_0 * rho_substrate);
  const delta_p = Math.sqrt(rho_plating / (Math.PI * freq * MU_0));
  const x = t / delta_p;

  // tanh((1+j)x) = (sinh(2x) + j·sin(2x)) / (cosh(2x) + cos(2x))
  const d = Math.cosh(2 * x) + Math.cos(2 * x);
  const T_re = Math.sinh(2 * x) / d;
  const T_im = Math.sin(2 * x) / d;

  // num = R_s_s + R_s_p · T,  den = R_s_p + R_s_s · T  (complex)
  const num_re = Rs_s + Rs_p * T_re;
  const num_im = Rs_p * T_im;
  const den_re = Rs_p + Rs_s * T_re;
  const den_im = Rs_s * T_im;

  // After factoring (1+j) out of η_p and η_s, the algebra collapses to
  // Z_in = (1+j) · R_s_p · (num / den), so R_s_eff = Re = A_re − A_im
  // where A = R_s_p · (num / den).
  const den_mag2 = den_re * den_re + den_im * den_im;
  const ratio_re = (num_re * den_re + num_im * den_im) / den_mag2;
  const ratio_im = (num_im * den_re - num_re * den_im) / den_mag2;
  const A_re = Rs_p * ratio_re;
  const A_im = Rs_p * ratio_im;
  return A_re - A_im;
}

export const SPC: Metal = {
  name: "SPC (1 µm Ag on OFHC Cu)",
  hasRRR: true,                       // exposed knob applies to the copper substrate
  color: "var(--color-copper)",
  // Display value: the *plating* resistivity — the calculator's "ρ_metal"
  // row and the derived skin-depth row then correctly reflect what's at
  // the surface where most of the RF current lives. The effective R_s
  // computed below is the value that actually drives α_c.
  resistivityAt(T) { return SILVER.resistivityAt(T); },
  // Bulk material drives heat conduction; see file-level note.
  thermalConductivityAt(T, rrr) { return COPPER.thermalConductivityAt(T, rrr); },
  surfaceResistanceAt(freq, T, rrr) {
    const rho_p = SILVER.resistivityAt(T);
    const rho_s = COPPER.resistivityAt(T, rrr);
    return layeredSurfaceResistance(freq, T_PLATING_M, rho_p, rho_s);
  },
};

export const SPC_PLATING_THICKNESS_M = T_PLATING_M;
