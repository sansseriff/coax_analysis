// American Wire Gauge → diameter
//
// Standard AWG formula: d(in) = 0.005 · 92^((36 - AWG)/39)
// Equivalent: each AWG step is the 39-th root of 92 (~1.1229×) in diameter.
// Formula is exact for AWG 0–40; we use the same analytic continuation
// for AWG 41–50 because vendor tables agree with it to <1%.

export function awgToMeters(awg: number): number {
  const d_in = 0.005 * Math.pow(92, (36 - awg) / 39);
  return d_in * 0.0254;
}

export function awgToMicrons(awg: number): number {
  return awgToMeters(awg) * 1e6;
}

/**
 * Equivalent single-wire AWG of a bundle of `n` parallel strands, by the
 * industry convention: gauge follows total metal cross-section, not the
 * bundle's outer diameter (which is larger because of the interstitial gaps).
 *
 * n strands ⇒ n× area ⇒ √n× equivalent diameter ⇒ shift of 39·ln(√n)/ln(92).
 *
 * Check: 7 strands of 42 AWG → 33.6 ≈ 34 AWG, matching the "34 AWG 7X42"
 * label on the New England Wire N12-42M datasheet.
 */
export function bundleAwg(strandAwg: number, nStrands: number): number {
  return strandAwg - (39 * Math.log(nStrands)) / (2 * Math.log(92));
}
