// NIST Teflon thermal conductivity polynomial — used as proxy by both
// PFA and FEP modules.
//
// log10(k) = a + b·x + c·x² + … + i·x⁸,  x = log10(T)
// Valid 4–300 K, ~5% accuracy.
// Source: https://trc.nist.gov/cryogenics/materials/Teflon/Teflon_rev.htm

const COEFFS = {
  a:  2.7380,
  b: -30.677,
  c:  89.430,
  d: -136.99,
  e:  124.69,
  f: -69.556,
  g:  23.320,
  h: -4.3135,
  i:  0.33829,
};

function teflonKPoly(T: number): number {
  const x = Math.log10(T);
  const p = COEFFS;
  const log10k = p.a + p.b*x + p.c*x**2 + p.d*x**3 + p.e*x**4 + p.f*x**5 + p.g*x**6 + p.h*x**7 + p.i*x**8;
  return Math.pow(10, log10k);
}

const K_TEFLON_AT_4K = teflonKPoly(4);

export function teflonKAt(T: number): number {
  if (T <= 0) return 0;
  // Below 4 K, amorphous polymers follow k ∝ T² (TLS + Debye phonons).
  if (T < 4) return K_TEFLON_AT_4K * (T / 4) ** 2;
  return teflonKPoly(T);
}
