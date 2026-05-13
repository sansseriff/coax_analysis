// Material interfaces for the coax calculator.
//
// Metal: electrical + thermal properties of a conductor. Some metals (OFHC Cu)
// have a meaningful RRR knob; others (alloyed brass) don't, so RRR is optional.
//
// Dielectric: same shape as the stripline calculator's interface so that
// Kapton from the parent project could be dropped in unchanged if needed.

export type Kelvin = number;

export interface Metal {
  readonly name: string;
  readonly hasRRR: boolean;
  readonly color: string;            // CSS variable name, e.g. "var(--color-copper)"
  /** Resistivity in Ω·m at temperature T. */
  resistivityAt(T: Kelvin, rrr?: number): number;
  /** Thermal conductivity in W/(m·K) at temperature T. */
  thermalConductivityAt(T: Kelvin, rrr?: number): number;
  /**
   * Effective surface resistance R_s (Ω) for the conductor at frequency f.
   * Optional: if absent, callers fall back to the bulk √(πfμ₀·ρ) form.
   * Override this for plated/layered conductors (e.g. SPC) where the
   * effective R_s differs from the resistivityAt() value.
   */
  surfaceResistanceAt?(freq: number, T: Kelvin, rrr?: number): number;
}

export interface Dielectric {
  readonly name: string;
  /** Relative permittivity at temperature T. */
  erAt(T: Kelvin): number;
  /** Loss tangent at temperature T and frequency f (Hz). */
  tanDeltaAt(T: Kelvin, f: number): number;
  /** Thermal conductivity in W/(m·K) at temperature T. */
  kAt(T: Kelvin): number;
  /** Free-text note shown in the UI when this dielectric is selected. */
  readonly note?: string;
}
