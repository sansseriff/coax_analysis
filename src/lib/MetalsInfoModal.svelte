<script lang="ts">
  import { COPPER, silverResistivityAt } from "./materials";

  let { open = $bindable(false) }: { open: boolean } = $props();

  // Plot geometry
  const W = 640;
  const H = 380;
  const padL = 70;
  const padR = 20;
  const padT = 20;
  const padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Log scale ranges
  const Tmin = 1;       // K
  const Tmax = 300;
  const RHOmin = 1e-11; // Ω·m
  const RHOmax = 5e-8;
  const logTmin = Math.log10(Tmin);
  const logTmax = Math.log10(Tmax);
  const logRmin = Math.log10(RHOmin);
  const logRmax = Math.log10(RHOmax);

  function xT(T: number): number {
    return padL + ((Math.log10(T) - logTmin) / (logTmax - logTmin)) * plotW;
  }
  function yR(rho: number): number {
    return padT + plotH - ((Math.log10(rho) - logRmin) / (logRmax - logRmin)) * plotH;
  }

  // Generate one ρ(T) curve as an SVG path.
  function curvePath(fn: (T: number) => number, N = 200): string {
    let d = "";
    for (let i = 0; i <= N; i++) {
      const logT = logTmin + (i / N) * (logTmax - logTmin);
      const T = Math.pow(10, logT);
      const rho = Math.max(fn(T), RHOmin * 0.5);
      d += (i === 0 ? "M" : "L") + xT(T).toFixed(1) + " " + yR(rho).toFixed(1) + " ";
    }
    return d;
  }

  // Curve sets — higher RRR = more opaque (cleaner metal)
  const cuCurves = [
    { rrr: 50,  opacity: 0.40, label: "Cu RRR 50"  },
    { rrr: 100, opacity: 0.70, label: "Cu RRR 100" },
    { rrr: 300, opacity: 1.00, label: "Cu RRR 300" },
  ];
  const agCurves = [
    { rrr: 10,  opacity: 0.40, label: "Ag RRR 10"  },
    { rrr: 30,  opacity: 0.70, label: "Ag RRR 30"  },
    { rrr: 100, opacity: 1.00, label: "Ag RRR 100" },
  ];

  // Decade gridlines
  const xTicks = [1, 2, 5, 10, 20, 50, 100, 200, 300];
  const xMajor = new Set([1, 10, 100, 300]);
  const yTicks = [1e-11, 1e-10, 1e-9, 1e-8, 5e-8];
  const yMajor = new Set([1e-11, 1e-10, 1e-9, 1e-8]);

  function fmtRho(r: number): string {
    if (r >= 1e-8) return (r * 1e8).toFixed(0) + "e-8";
    if (r >= 1e-9) return (r * 1e9).toFixed(0) + "e-9";
    if (r >= 1e-10) return (r * 1e10).toFixed(0) + "e-10";
    return (r * 1e11).toFixed(0) + "e-11";
  }

  function close() { open = false; }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop as a real button so click + keyboard close are accessible -->
    <button
      type="button"
      aria-label="Close dialog"
      class="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
      onclick={close}
    ></button>

    <!-- Modal body -->
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Metal resistivity reference"
      class="relative max-w-[820px] w-full max-h-[90vh] overflow-y-auto
             rounded-[12px] border border-border bg-white dark:bg-[#15181f]
             shadow-2xl p-6"
    >
      <button
        class="absolute top-3 right-3 w-8 h-8 rounded-md border border-border
               text-text-secondary hover:text-text-primary hover:bg-surface
               flex items-center justify-center cursor-pointer text-lg"
        onclick={close}
        aria-label="Close"
      >×</button>

      <h2 class="text-[18px] font-semibold tracking-tight mb-1">
        Why SPC barely beats bare OFHC for RF
      </h2>
      <p class="text-[12px] text-text-muted mb-4">
        Resistivity vs temperature for OFHC copper and electroplated silver
        across the RRR ranges typical of each.
      </p>

      <svg viewBox="0 0 {W} {H}" class="w-full h-auto" style="max-height:380px">
        <!-- Cryo band shading (T < 20 K) -->
        <rect
          x={xT(1)} y={padT}
          width={xT(20) - xT(1)} height={plotH}
          fill="var(--color-accent)" opacity="0.05"
        />
        <text x={xT(4)} y={padT + 14} text-anchor="middle"
              class="font-mono fill-text-muted" style="font-size:10px">
          cryo
        </text>

        <!-- Reference verticals at 4 K and 295 K -->
        {#each [4, 295] as Tref}
          <line
            x1={xT(Tref)} y1={padT} x2={xT(Tref)} y2={padT + plotH}
            stroke="var(--color-text-muted)" stroke-width="0.5"
            stroke-dasharray="2 3" opacity="0.6"
          />
          <text x={xT(Tref)} y={padT + plotH + 26} text-anchor="middle"
                class="font-mono fill-text-secondary" style="font-size:10px">
            {Tref} K
          </text>
        {/each}

        <!-- Y gridlines + labels -->
        {#each yTicks as r}
          <line
            x1={padL} y1={yR(r)} x2={padL + plotW} y2={yR(r)}
            stroke="var(--color-border)"
            stroke-width={yMajor.has(r) ? 0.8 : 0.4}
            opacity={yMajor.has(r) ? 0.7 : 0.4}
          />
          {#if yMajor.has(r)}
            <text x={padL - 8} y={yR(r) + 3} text-anchor="end"
                  class="font-mono fill-text-secondary" style="font-size:10px">
              {fmtRho(r)}
            </text>
          {/if}
        {/each}

        <!-- X gridlines + labels -->
        {#each xTicks as T}
          <line
            x1={xT(T)} y1={padT} x2={xT(T)} y2={padT + plotH}
            stroke="var(--color-border)"
            stroke-width={xMajor.has(T) ? 0.6 : 0.3}
            opacity={xMajor.has(T) ? 0.5 : 0.3}
          />
          {#if xMajor.has(T)}
            <text x={xT(T)} y={padT + plotH + 14} text-anchor="middle"
                  class="font-mono fill-text-secondary" style="font-size:10px">
              {T}
            </text>
          {/if}
        {/each}

        <!-- Axis labels -->
        <text x={padL + plotW / 2} y={H - 6} text-anchor="middle"
              class="font-mono fill-text-secondary" style="font-size:11px">
          Temperature T (K)
        </text>
        <text
          x={-padT - plotH / 2}
          y={16}
          text-anchor="middle"
          transform="rotate(-90)"
          class="font-mono fill-text-secondary"
          style="font-size:11px"
        >
          ρ (Ω·m)
        </text>

        <!-- Plot frame -->
        <rect
          x={padL} y={padT} width={plotW} height={plotH}
          fill="none" stroke="var(--color-border)" stroke-width="1"
        />

        <!-- Copper curves -->
        {#each cuCurves as c}
          <path
            d={curvePath((T) => COPPER.resistivityAt(T, c.rrr))}
            fill="none"
            stroke="var(--color-copper)"
            stroke-width="1.8"
            opacity={c.opacity}
          />
        {/each}

        <!-- Silver curves (dashed) -->
        {#each agCurves as c}
          <path
            d={curvePath((T) => silverResistivityAt(T, c.rrr))}
            fill="none"
            stroke="var(--color-text-primary)"
            stroke-width="1.8"
            stroke-dasharray="5 3"
            opacity={c.opacity}
          />
        {/each}
      </svg>

      <!-- Legend -->
      <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono">
        <div>
          <div class="text-text-muted uppercase tracking-[1px] mb-1">
            OFHC copper (solid)
          </div>
          {#each cuCurves as c}
            <div class="flex items-center gap-2">
              <svg width="28" height="6"><line
                x1="0" y1="3" x2="28" y2="3"
                stroke="var(--color-copper)" stroke-width="2"
                opacity={c.opacity}
              /></svg>
              <span class="text-text-secondary">{c.label}</span>
            </div>
          {/each}
        </div>
        <div>
          <div class="text-text-muted uppercase tracking-[1px] mb-1">
            Electroplated silver (dashed)
          </div>
          {#each agCurves as c}
            <div class="flex items-center gap-2">
              <svg width="28" height="6"><line
                x1="0" y1="3" x2="28" y2="3"
                stroke="var(--color-text-primary)" stroke-width="2"
                stroke-dasharray="5 3"
                opacity={c.opacity}
              /></svg>
              <span class="text-text-secondary">{c.label}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Explanation -->
      <div class="mt-5 space-y-3 text-[12.5px] text-text-secondary leading-relaxed">
        <p>
          <span class="font-semibold text-text-primary">At room temperature</span>,
          ρ is dominated by phonon (lattice) scattering — a metallurgy-independent
          number set only by the crystal structure. All six curves on the right
          edge of the plot collapse to within a few percent. Switching from Cu to
          Ag here buys you about <span class="font-mono">3% lower R_s</span>, and
          the RRR of the plating barely matters.
        </p>
        <p>
          <span class="font-semibold text-text-primary">At cryogenic temperatures</span>,
          phonons freeze out and ρ floors at the <em>residual</em> value
          ρ_res = ρ(295 K) / RRR. RRR is now everything. OFHC Cu drawn for cables
          routinely hits <span class="font-mono">RRR 50–300</span>; commercial
          bright silver plating is <span class="font-mono">RRR 10–30</span>
          because of brightener contamination, grain boundaries, and trapped
          electrolyte. Bottom of the plot: clean Cu wins by 1–2 orders of magnitude.
        </p>
        <p>
          <span class="font-semibold text-text-primary">Why SPC doesn't recover at cryo</span>:
          at 2 GHz the silver skin depth at 4 K is ~0.25 µm — less than the
          plating thickness — so the RF current never reaches the clean copper
          underneath. The cable sees the residual ρ of the dirty plating, not
          the substrate. SPC can be <em>worse</em> than bare OFHC at cryo for
          this reason. The calculator's layered R_s model captures this; toggle
          between SPC and Cu in the metal selector to see the size of the effect
          at your chosen frequency and stage.
        </p>
        <p>
          <span class="font-semibold text-text-primary">So why silver-plate at all?</span>
          The real driver is environmental: copper oxide grows on bare Cu in air
          and is poorly conductive, sitting right in the skin-depth region.
          Silver tarnish (Ag₂S) is slower and more conductive. Plus solderability,
          stable contact resistance at connectors, and process compatibility. SPC
          is bought for <em>oxide control</em>, not conductivity.
        </p>
      </div>
    </div>
  </div>
{/if}
