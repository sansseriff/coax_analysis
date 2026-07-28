// Silver — used as the plating layer in SPC (silver-plated copper).
//
// Only the *electrical* properties matter for the RF surface-impedance model:
// for thermal conduction the 1 µm plating contributes a few-% correction at
// most over the bulk copper substrate, so the SPC wrapper uses copper's k.
//
// Resistivity:
//   ρ(295 K) = 1.59e-8 Ω·m   (CRC Handbook)
//   ρ_residual depends on the plating quality. Electroplated silver has
//   substantial grain-boundary and impurity scattering; published values
//   for as-plated silver land in the RRR ≈ 10–50 range, vastly worse than
//   high-purity bulk silver (RRR > 1000). We use RRR_Ag = 30 as a typical
//   middle-of-the-road value for cable-grade silver plating.
//   ⇒ ρ_residual = 1.59e-8 / 30 ≈ 5.3e-10 Ω·m.
//
// Temperature interpolation: same (T-10)/285 power-law shape used for the
// copper and brass modules, anchored at the 295 K and residual endpoints.
// This is approximate (~10% in the 10–80 K transition band) but adequate
// given that the residual itself is uncertain to a factor of ~2.

import type { Metal } from "./types";

const RHO_AG_295 = 1.59e-8;             // Ω·m
export const RRR_AG_PLATED_DEFAULT = 30;

/** Silver resistivity at temperature T, parameterised on RRR.  Useful for
 *  the info-modal plot that sweeps across plausible electroplate qualities. */
export function silverResistivityAt(T: number, rrr: number = RRR_AG_PLATED_DEFAULT): number {
  const rho_res = RHO_AG_295 / rrr;
  if (T <= 10)  return rho_res;
  if (T >= 295) return RHO_AG_295;
  return rho_res + (RHO_AG_295 - rho_res) * Math.pow((T - 10) / 285, 1.3);
}

function silverResistivity(T: number): number {
  return silverResistivityAt(T, RRR_AG_PLATED_DEFAULT);
}

// Wiedemann–Franz with the electrical resistivity model above.
// Silver is electronically dominated like all decent metals, so WF is good
// to ~10% over the full 4–300 K range. We don't use this for SPC (which
// uses the copper substrate's k for heat-load integrals), but it's here so
// the Metal interface is satisfied if anyone wires up pure silver elsewhere.
const LORENZ = 2.44e-8; // W·Ω/K²
function silverThermalConductivity(T: number): number {
  if (T <= 0) return 0;
  return LORENZ * T / silverResistivity(T);
}

export const SILVER: Metal = {
  name: "Silver (electroplate, RRR≈30)",
  hasRRR: false,
  color: "var(--color-copper)",
  resistivityAt(T) { return silverResistivity(T); },
  thermalConductivityAt(T) { return silverThermalConductivity(T); },
};

export const _SILVER_DEBUG = { RHO_AG_295, RRR_AG_PLATED_DEFAULT };
