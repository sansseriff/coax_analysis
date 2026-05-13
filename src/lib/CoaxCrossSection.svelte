<script lang="ts">
  // Cross-section diagram of a stranded coax.
  //
  // All input radii are in metres. We draw in metres directly and let the
  // SVG viewBox normalise — that way the cable always fits regardless of size.

  let {
    rInner,           // inner strand radius (m)
    rOuterStrand,     // outer-shield strand radius (m)
    rRing,            // radius of circle on which outer-strand centres sit (m)
    nOuter,           // number of outer strands
    metalColor,       // CSS var name for strand fill
    a,                // dielectric inner radius (m) = 3·rInner
    b,                // dielectric outer radius (m) = rRing - rOuterStrand
  }: {
    rInner: number;
    rOuterStrand: number;
    rRing: number;
    nOuter: number;
    metalColor: string;
    a: number;
    b: number;
  } = $props();

  // ── viewBox sizing ──
  // Pick a half-width covering the cable + a little padding for labels.
  const padFrac = 0.18;
  let halfBox = $derived((rRing + rOuterStrand) * (1 + padFrac));

  // Inner strand centres: 1 at origin + 6 hex petals at 2·rInner.
  let innerCenters = $derived(
    [{ x: 0, y: 0 }].concat(
      Array.from({ length: 6 }, (_, k) => ({
        x: 2 * rInner * Math.cos((k * Math.PI) / 3),
        y: 2 * rInner * Math.sin((k * Math.PI) / 3),
      })),
    ),
  );

  // Outer strand centres: nOuter evenly spaced on circle of radius rRing.
  let outerCenters = $derived(
    Array.from({ length: nOuter }, (_, k) => ({
      x: rRing * Math.cos((2 * Math.PI * k) / nOuter),
      y: rRing * Math.sin((2 * Math.PI * k) / nOuter),
    })),
  );

  // ── dimension-annotation positions ──
  // Place labels in µm for readability.
  const um = (m: number) => (m * 1e6).toFixed(0);
</script>

<svg
  viewBox="{-halfBox} {-halfBox} {2 * halfBox} {2 * halfBox}"
  class="w-full"
  style="max-height: 460px"
>
  <!-- 1. Dielectric annulus (between bundle and shield inside-edge) -->
  <circle cx="0" cy="0" r={rRing + rOuterStrand}
          fill="var(--color-jacket)"
          stroke="var(--color-border)" stroke-width={halfBox * 0.003} />
  <circle cx="0" cy="0" r={rRing - rOuterStrand}
          fill="var(--color-dielectric)"
          stroke="var(--color-border)" stroke-width={halfBox * 0.003} />

  <!-- 2. Outer-shield strands -->
  {#each outerCenters as c}
    <circle cx={c.x} cy={c.y} r={rOuterStrand}
            fill={metalColor}
            stroke="rgba(0,0,0,0.35)" stroke-width={halfBox * 0.0015} />
  {/each}

  <!-- 3. Inner bundle area (paint dielectric "core" gap that exists outside the inner strands but inside r=a — visually it's already covered by the previous dielectric ring, so this just gives a slightly distinct shade if needed). -->
  <circle cx="0" cy="0" r={a}
          fill="var(--color-dielectric)"
          stroke="var(--color-border)" stroke-width={halfBox * 0.002}
          opacity="0.6" />

  <!-- 4. Inner 7 strands -->
  {#each innerCenters as c}
    <circle cx={c.x} cy={c.y} r={rInner}
            fill={metalColor}
            stroke="rgba(0,0,0,0.35)" stroke-width={halfBox * 0.0015} />
  {/each}

  <!-- 5. Dimension annotations (right side) -->
  <g font-family="var(--font-mono)" font-size={halfBox * 0.045}
     fill="var(--color-text-secondary)">
    <!-- a marker -->
    <line x1="0" y1="0" x2={a} y2="0"
          stroke="var(--color-text-muted)" stroke-width={halfBox * 0.0025}
          stroke-dasharray="{halfBox * 0.008},{halfBox * 0.008}" />
    <text x={a / 2} y={-halfBox * 0.015} text-anchor="middle">
      a = {um(a)} µm
    </text>

    <!-- b marker (along the +y axis to avoid clashing) -->
    <line x1="0" y1="0" x2="0" y2={-b}
          stroke="var(--color-text-muted)" stroke-width={halfBox * 0.0025}
          stroke-dasharray="{halfBox * 0.008},{halfBox * 0.008}" />
    <text x={halfBox * 0.02} y={-b / 2} text-anchor="start">
      b = {um(b)} µm
    </text>

    <!-- rRing marker -->
    <line x1="0" y1="0" x2={-rRing} y2="0"
          stroke="var(--color-text-muted)" stroke-width={halfBox * 0.002} />
    <text x={-rRing / 2} y={halfBox * 0.06} text-anchor="middle">
      R = {um(rRing)} µm
    </text>

    <!-- OD label below -->
    <text x="0" y={halfBox * 0.93} text-anchor="middle">
      OD = {um(2 * (rRing + rOuterStrand))} µm  ({((rRing + rOuterStrand) * 2 / 0.0254).toFixed(4)}")
    </text>
  </g>
</svg>
