// Cable presets.
//
// rRing_um and nOuter are the two free parameters used to tune Z₀ → 50 Ω
// and to match the datasheet shield OD (for TCF-3450F) or overall OD
// (for N12-42M-100006-1). The values below are seed points; the in-app
// preset buttons will snap to them and the user can dial finely from there.
//
// AWG conventions:
//   TCF-3450F: "34 AWG" labels the bundle Ø 0.0075". Bundle Ø = 3·r_innerStrand
//     ⇒ r_innerStrand = 0.00125" ≈ 31.75 µm ⇒ inner-strand AWG ≈ 42.
//     46 AWG outer strands per the datasheet.
//   NEW N12-42M: explicit 7×42 inner + 44 AWG outer per the datasheet.

export interface CoaxPreset {
  key: string;
  name: string;
  description: string;

  innerAwg: number;
  outerAwg: number;
  nOuter: number;
  rRing_um: number;
  layInner_deg: number;
  layOuter_deg: number;

  metal: "copper" | "brass" | "spc";
  rrr?: number;          // applies to copper or to the SPC substrate
  dielectric: "pfa" | "fepFoam" | "fepSolid";
  foamFraction?: number; // only for fepFoam

  // Per-side K_s correction multipliers (1 = use formula as-is).
  // Set from calibration against a measured IL curve.
  K_s_inner_correction?: number;
  K_s_outer_correction?: number;

  // For display only:
  datasheetShieldOD_in?: number;
  datasheetCableOD_in?: number;
  datasheetZ0?: number;
}

export const PRESETS: Record<string, CoaxPreset> = {
  samtec_tcf3450f: {
    key: "samtec_tcf3450f",
    name: "Samtec TCF-3450F",
    description: "34 AWG (7×42) SPC / FEP-foam / 46 AWG SPC serve shield, 50 Ω",
    innerAwg: 42,
    outerAwg: 46,
    nOuter: 36,
    // Derived from datasheet shield OD 0.0221" and 46 AWG strand:
    //   rRing = shieldOD/2 − r_46 = 280.7 − 19.9 = 260.8 µm.
    rRing_um: 261,
    layInner_deg: 8,
    layOuter_deg: 20,
    metal: "spc",
    rrr: 50,
    dielectric: "fepFoam",
    // ε_r needed for 50 Ω at this b/a is ≈ 1.246; Wiener-mix solid fraction = 0.234.
    foamFraction: 0.77,
    // K_s is split per-conductor.  At this geometry:
    //   K_s_inner_formula = sec(8°)            = 1.010
    //   K_s_outer_formula = (1/0.874)·sec(20°) = 1.217
    // Pozar (1/a + 1/b) weighting puts 71.7% of the smooth-coax loss on
    // the inner term and 28.3% on the outer.
    //
    // Calibrated for the 1–4 GHz band against the TCF-3450F datasheet
    // IL curve:
    //   inner correction = 1.0   (formula is fine for a bare 7-strand SPC bundle)
    //   outer correction = 1.55  (matches ~3 dB/m at 2 GHz)
    //
    // The measured IL scales as ~f^0.72, not √f, so no constant K_s can
    // fit the full 2–12 GHz band — a Hammerstad–Jensen surface-roughness
    // factor would be needed.  This setting prioritises a tight match in
    // the 1–3 GHz region (~±10% across the band) at the cost of
    // under-predicting above 4 GHz.  For broader bands, raise the outer
    // slider: ~2.25 for a 2–8 GHz compromise, ~3.3 for 6–12 GHz emphasis.
    K_s_inner_correction: 1.0,
    K_s_outer_correction: 1.55,
    datasheetShieldOD_in: 0.0221,
    datasheetCableOD_in: 0.0320,
    datasheetZ0: 50,
  },
  new_n12_42m: {
    key: "new_n12_42m",
    name: "NEW N12-42M-100006-1",
    description: "34 AWG (7×42) C27000 brass / PFA / 44 AWG brass spiral shield, 50 Ω",
    innerAwg: 42,
    outerAwg: 44,
    nOuter: 32,
    // Derived assuming 0.038" cable OD minus 2×0.005" PFA jacket → shield OD 0.028",
    // then rRing = shieldOD/2 − r_44 = 355.6 − 25.1 = 330.5 µm.
    rRing_um: 330,
    layInner_deg: 8,
    layOuter_deg: 20,
    metal: "brass",
    dielectric: "pfa",
    // No IL datasheet for the NEW cable — transfer the Samtec-calibrated
    // 1–4 GHz outer correction as a first-order estimate.  Note this
    // cable has a SPIRAL shield (single layer, 77% coverage) which is
    // geometrically gappier than the Samtec serve.  The coverage gap is
    // *already* captured by the K_s_outer formula (which scales as
    // 1/coverage), so we use the same correction factor.
    K_s_inner_correction: 1.0,
    K_s_outer_correction: 1.55,
    datasheetCableOD_in: 0.0380,
    datasheetZ0: 50,
  },

  // ── Hypothetical scaled-up variants of the N12-42M ──────────────────────
  //
  // "What does the heat load look like if we just build the same cable
  // bigger?"  Both keep the N12's construction verbatim — C27000 brass,
  // solid PFA, 7-strand inner bundle, single-layer spiral shield, 8°/20° lay
  // angles, same K_s corrections — and scale the geometry.  Three constraints
  // fix the numbers, in priority order:
  //
  //   1. Z₀ = 50 Ω.  Set by b/a, so it pins the inner-strand AWG against
  //      rRing.  This is the constraint that wins where they conflict.
  //   2. Shield coverage ≈ 0.775, the N12's value — otherwise K_s_outer
  //      changes and the RF comparison stops being like-for-like.  Fixes
  //      nOuter once the outer-strand AWG is chosen.
  //   3. Cable OD = 2× / 3× the N12's 0.028".
  //
  // Strand AWG is an integer in the real world, and one AWG step is a fixed
  // 1.1229× in diameter, so (1)–(3) cannot all be satisfied exactly at the
  // 3× point: it wants a 32.6 AWG inner and a 34.5 AWG outer.  Rounding to
  // 33/34 and then trimming rRing back to hold 50 Ω lands the OD at 2.90×
  // rather than 3.00×.  The 2× point is clean — it is the N12 with every
  // strand exactly one octave (6 AWG) thicker and rRing doubled.
  new_doubled: {
    key: "new_doubled",
    name: "NEW-Doubled",
    description: "2× N12-42M scale — 28 AWG (7×36) brass / PFA / 38 AWG brass spiral shield, 50 Ω",
    // 42 + 6 → 36 and 44 + 6 → 38: each strand exactly 2× in diameter.
    // nOuter is unchanged because coverage is invariant under uniform scaling.
    innerAwg: 36,
    outerAwg: 38,
    nOuter: 32,
    rRing_um: 660, // 2 × 330
    layInner_deg: 8,
    layOuter_deg: 20,
    metal: "brass",
    dielectric: "pfa",
    K_s_inner_correction: 1.0,
    K_s_outer_correction: 1.55,
    datasheetZ0: 50,
  },
  new_tripled: {
    key: "new_tripled",
    name: "NEW-Tripled",
    description: "≈3× N12-42M scale — 25 AWG (7×33) brass / PFA / 34 AWG brass spiral shield, 50 Ω",
    // Nearest integer AWGs to a true 3× scale (32.53 / 34.53), with rRing
    // trimmed from 990 to 950 µm to bring Z₀ back to 50.0 Ω and nOuter cut
    // from 32 to 29 to hold coverage at 0.78.  Net OD is 2.90× the N12.
    innerAwg: 33,
    outerAwg: 34,
    nOuter: 29,
    rRing_um: 950,
    layInner_deg: 8,
    layOuter_deg: 20,
    metal: "brass",
    dielectric: "pfa",
    K_s_inner_correction: 1.0,
    K_s_outer_correction: 1.55,
    datasheetZ0: 50,
  },
};
