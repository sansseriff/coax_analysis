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
