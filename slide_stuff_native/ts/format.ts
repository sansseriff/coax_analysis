/** Number formatting helpers for slide metrics. */

export function fmt(v: number, d = 2): string {
	if (isNaN(v) || !isFinite(v)) return '—';
	if (Math.abs(v) >= 1000) return v.toFixed(0);
	if (Math.abs(v) >= 1) return v.toFixed(d);
	if (Math.abs(v) >= 0.01) return v.toFixed(d + 1);
	return v.toExponential(2);
}

/** Metres → mm, fixed precision. */
export const mm = (m: number, d = 2): string => (m * 1e3).toFixed(d);

/** Metres → mils (thousandths of an inch). */
export const mils = (m: number, d = 1): string => ((m / 0.0254) * 1000).toFixed(d);

/**
 * Heat load with adaptive units. Values span ~1 µW (4→1 K, brass) to ~35 mW
 * (40→4 K, copper), so pick mW above 1000 µW. Returns value + unit separately
 * so the unit can be styled.
 */
export function heatParts(uW: number): { v: string; u: string } {
	if (!isFinite(uW) || isNaN(uW)) return { v: '—', u: '' };
	// Full-harness totals (×208) reach several watts, so add a W tier.
	if (Math.abs(uW) >= 1e6) return { v: (uW / 1e6).toFixed(uW >= 1e7 ? 1 : 2), u: 'W' };
	if (Math.abs(uW) >= 1000) return { v: (uW / 1000).toFixed(uW >= 10000 ? 1 : 2), u: 'mW' };
	if (Math.abs(uW) >= 10) return { v: uW.toFixed(0), u: 'µW' };
	return { v: uW.toFixed(1), u: 'µW' };
}

/** Single-string heat formatter for tables. */
export function fmtHeat(uW: number): string {
	const { v, u } = heatParts(uW);
	return u ? `${v} ${u}` : v;
}
