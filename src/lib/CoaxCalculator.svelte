<script lang="ts">
  import Slider from "./Slider.svelte";
  import Metric from "./Metric.svelte";
  import CoaxCrossSection from "./CoaxCrossSection.svelte";
  import MetalsInfoModal from "./MetalsInfoModal.svelte";

  import { awgToMeters } from "./awg";
  import { METALS, RRR_OPTIONS, PFA, FEP_SOLID, makeFepFoam, type Dielectric } from "./materials";
  import { computeCoax, type Stage } from "./coax-physics";
  import { PRESETS, type CoaxPreset } from "./presets";

  // ─── State ───
  let presetKey = $state<string>("samtec_tcf3450f");

  // Geometry
  let innerAwg = $state(42);
  let outerAwg = $state(46);
  let nOuter = $state(36);
  let rRing_um = $state(261);
  let layInner_deg = $state(8);
  let layOuter_deg = $state(20);

  // Materials
  let metalKey = $state<"copper" | "brass" | "spc">("spc");
  let showMetalsInfo = $state(false);
  let rrr = $state(50);
  let dielKey = $state<"pfa" | "fepFoam" | "fepSolid">("fepFoam");
  let foamFraction = $state(0.45);

  // Per-side stranding-penalty corrections (multiplicative on top of formula).
  // 1.0 means "trust the formula as-is".
  let K_s_inner_correction = $state(1.0);
  let K_s_outer_correction = $state(1.0);

  // Operating conditions
  let stage = $state<Stage>("40to4");
  let freqGHz = $state(2.0);
  let lengthM = $state(1.0);

  // ─── Apply preset ───
  function applyPreset(p: CoaxPreset) {
    presetKey = p.key;
    innerAwg = p.innerAwg;
    outerAwg = p.outerAwg;
    nOuter = p.nOuter;
    rRing_um = p.rRing_um;
    layInner_deg = p.layInner_deg;
    layOuter_deg = p.layOuter_deg;
    metalKey = p.metal;
    rrr = p.rrr ?? 50;
    dielKey = p.dielectric;
    foamFraction = p.foamFraction ?? 0.45;
    K_s_inner_correction = p.K_s_inner_correction ?? 1.0;
    K_s_outer_correction = p.K_s_outer_correction ?? 1.0;
  }

  // ─── Derived ───
  let rInner = $derived(awgToMeters(innerAwg) / 2);
  let rOuterStrand = $derived(awgToMeters(outerAwg) / 2);
  let rRing = $derived(rRing_um * 1e-6);
  let layInner = $derived(layInner_deg * Math.PI / 180);
  let layOuter = $derived(layOuter_deg * Math.PI / 180);

  let metal = $derived(METALS[metalKey]);
  let dielectric: Dielectric = $derived(
    dielKey === "pfa" ? PFA :
    dielKey === "fepSolid" ? FEP_SOLID :
    makeFepFoam(foamFraction)
  );

  let results = $derived(
    computeCoax({
      rInner, rOuterStrand, rRing, nOuter,
      layInner, layOuter,
      length: lengthM,
      freq: freqGHz * 1e9,
      stage,
      metal,
      rrr: metal.hasRRR ? rrr : undefined,
      dielectric,
      K_s_inner_correction,
      K_s_outer_correction,
    }),
  );

  // ─── Status colors ───
  let z0Ok = $derived(
    results.Z0 >= 45 && results.Z0 <= 55 ? true :
    results.Z0 >= 40 && results.Z0 <= 60 ? null : false,
  );

  // ─── RF loss donut data ───
  let condFrac = $derived(
    isFinite(results.alphaTotal_dBm) && results.alphaTotal_dBm > 0
      ? results.alphaCond_dBm / results.alphaTotal_dBm
      : 0.5,
  );
  let dielFrac = $derived(1 - condFrac);

  function donutArc(cx: number, cy: number, r: number, ri: number, a0: number, sweep: number): string {
    const GAP = 0.04;
    const s = a0 + GAP / 2;
    const sw = Math.max(sweep - GAP, 0);
    if (sw < 0.005) return "";
    const a1 = s + sw;
    const pt = (a: number, rad: number) =>
      `${(cx + rad * Math.sin(a)).toFixed(2)} ${(cy - rad * Math.cos(a)).toFixed(2)}`;
    const lg = sw > Math.PI ? 1 : 0;
    return `M${pt(s, r)} A${r} ${r} 0 ${lg} 1 ${pt(a1, r)} L${pt(a1, ri)} A${ri} ${ri} 0 ${lg} 0 ${pt(s, ri)}Z`;
  }

  function fmt(v: number, d = 2): string {
    if (isNaN(v) || !isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toFixed(0);
    if (Math.abs(v) >= 1) return v.toFixed(d);
    if (Math.abs(v) >= 0.01) return v.toFixed(d + 1);
    return v.toExponential(2);
  }

  // Current preset's datasheet hints, for the "delta to datasheet" rows
  let currentPreset = $derived(PRESETS[presetKey]);

  let breakdown = $derived(
    [
      ["Z₀",                        `${fmt(results.Z0, 2)} Ω`],
      ["Dielectric inner radius a", `${fmt(results.a * 1e6)} µm`],
      ["Dielectric outer radius b", `${fmt(results.b * 1e6)} µm`],
      ["Dielectric OD (2b)",        `${fmt(results.b * 2 / 0.0254 * 1000, 2)} mils (${fmt(results.b * 2 * 1e3, 3)} mm)`],
      ["Cable OD",                  `${fmt(results.cableOD / 0.0254 * 1000, 2)} mils (${fmt(results.cableOD * 1e3, 3)} mm)`],
      null,
      ["Shield strand coverage",    `${(results.coverage * 100).toFixed(1)} %`],
      ["K_s_inner (formula)",       fmt(results.K_s_inner_formula, 3)],
      ["K_s_inner (in use)",        `${fmt(results.K_s_inner, 3)} (× ${fmt(K_s_inner_correction, 2)} correction)`],
      ["K_s_outer (formula)",       fmt(results.K_s_outer_formula, 3)],
      ["K_s_outer (in use)",        `${fmt(results.K_s_outer, 3)} (× ${fmt(K_s_outer_correction, 2)} correction)`],
      null,
      ["T_avg",                     `${fmt(results.Tavg, 2)} K`],
      ["ρ_metal @ T_avg",           `${fmt(results.rhoMetal * 1e8, 3)} µΩ·cm`],
      ["ρ_metal @ 295 K",           `${fmt(results.rhoMetalRT * 1e8, 3)} µΩ·cm`],
      ["Skin depth @ T_avg",        `${fmt(results.skinDepth_um, 2)} µm`],
      ["Surface resistance R_s",    `${fmt(results.Rs * 1000, 2)} mΩ`],
      ["ε_r @ T_avg",               fmt(results.er, 3)],
      ["tan δ @ T_avg",             results.tanD.toExponential(2)],
      null,
      ["Conductor loss — inner",    `${fmt(results.alphaCond_inner_dBm, 3)} dB/m`],
      ["Conductor loss — outer",    `${fmt(results.alphaCond_outer_dBm, 3)} dB/m`],
      ["Conductor loss — total",    `${fmt(results.alphaCond_dBm, 3)} dB/m`],
      ["Dielectric loss",           `${fmt(results.alphaDiel_dBm, 3)} dB/m`],
      ["Total α (cryo)",            `${fmt(results.alphaTotal_dBm, 3)} dB/m`],
      ["Total loss (cryo, ×L)",     `${fmt(results.totalLoss_dB, 3)} dB`],
      ["Total loss (RT reference)", `${fmt(results.totalLossRT_dB, 3)} dB`],
      null,
      ["Q̇ inner bundle",           `${fmt(results.Qinner_uW, 2)} µW`],
      ["Q̇ outer shield",           `${fmt(results.Qouter_uW, 2)} µW`],
      ["Q̇ dielectric",             `${fmt(results.Qdiel_uW, 2)} µW`],
      ["Q̇ TOTAL per cable",        `${fmt(results.Qtotal_uW, 2)} µW`],
    ] as ([string, string] | null)[],
  );

  // Compute deltas vs datasheet for the active preset (display only)
  let deltaRows = $derived.by(() => {
    const rows: [string, string][] = [];
    if (currentPreset.datasheetShieldOD_in !== undefined) {
      // Shield OD in this model = 2·(rRing + rOuterStrand)
      const model_in = results.cableOD / 0.0254;
      const ds_in = currentPreset.datasheetShieldOD_in;
      rows.push([
        "Shield OD vs datasheet",
        `${(model_in * 1000).toFixed(1)} mils vs ${(ds_in * 1000).toFixed(1)} mils (${((model_in - ds_in) / ds_in * 100).toFixed(1)}%)`,
      ]);
    }
    if (currentPreset.datasheetCableOD_in !== undefined && currentPreset.datasheetShieldOD_in === undefined) {
      // Model OD is the shield OD; the datasheet "cable OD" includes the outer
      // jacket. For N12-42M the jacket is 0.005" thick PFA, so expected shield
      // OD = cable OD − 2·0.005" = cable OD − 0.010".
      const model_in = results.cableOD / 0.0254;
      const ds_in = currentPreset.datasheetCableOD_in;
      const implied_shield_in = ds_in - 0.010;
      rows.push([
        "Shield OD (no jacket) vs datasheet implied",
        `${(model_in * 1000).toFixed(1)} mils vs ${(implied_shield_in * 1000).toFixed(1)} mils (${((model_in - implied_shield_in) / implied_shield_in * 100).toFixed(1)}%)`,
      ]);
      rows.push([
        "Full cable OD w/ 0.005\" jacket (computed)",
        `${((model_in + 0.010) * 1000).toFixed(1)} mils vs ${(ds_in * 1000).toFixed(1)} mils datasheet`,
      ]);
    }
    if (currentPreset.datasheetZ0 !== undefined) {
      const z = results.Z0;
      const dz = currentPreset.datasheetZ0;
      rows.push(["Z₀ vs datasheet target", `${z.toFixed(2)} Ω vs ${dz} Ω (Δ=${(z - dz).toFixed(2)})`]);
    }
    return rows;
  });
</script>

<div class="p-7">
  <div class="max-w-[1100px] mx-auto">
    <!-- Header -->
    <h1 class="text-[22px] font-semibold tracking-tight mb-1
               bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent">
      Cryogenic Stranded-Coax Cable Analysis
    </h1>
    <p class="text-[13px] text-text-muted mb-5">
      Brass vs. SPC micro-coax · RF loss + thermal load at 1–4 K and 4–40 K
    </p>

    <!-- Preset row -->
    <div class="mb-5 p-[14px] rounded-[10px] border border-border bg-surface">
      <div class="text-[11px] text-accent uppercase tracking-[1.5px] mb-2 font-semibold">
        Presets — snap to known cable specs
      </div>
      <div class="flex flex-wrap gap-2">
        {#each Object.values(PRESETS) as p}
          <button
            class="px-4 py-2 rounded-md border border-border font-mono text-[12px] text-left transition-all cursor-pointer
                   {presetKey === p.key ? 'bg-accent text-white font-semibold' : 'bg-transparent text-text-secondary'}"
            onclick={() => applyPreset(p)}
            title={p.description}
          >
            <div class="font-semibold">{p.name}</div>
            <div class="text-[10px] opacity-80 mt-0.5">{p.description}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Stage + freq + length -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 mb-5">
      <div class="flex gap-2 flex-wrap">
        {#each [
          { v: '40to4', label: '40 K → 4 K', title: 'Operating: 4 K cold stage, 40 K hot stage' },
          { v: '4to1',  label: '4 K → 1 K',  title: 'Operating: 1 K cold stage, 4 K hot stage' },
          { v: 'calRT', label: '300 K calibration', title: 'All properties at 295 K — match datasheet IL curve to tune K_s' },
        ] as s}
          <button
            class="px-5 py-2 rounded-md border border-border font-mono text-[13px] transition-all cursor-pointer
                   {stage === s.v ? 'bg-accent text-white font-semibold' : 'bg-transparent text-text-secondary'}"
            onclick={() => (stage = s.v as Stage)}
            title={s.title}
          >
            {s.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Left column: controls -->
      <div class="space-y-4">
        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-accent uppercase tracking-[1.5px] mb-3.5 font-semibold">
            Conductor (inner & outer)
          </div>

          <div class="mb-3">
            <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-1.5">Metal</div>
            <div class="flex gap-2">
              {#each Object.entries(METALS) as [key, m]}
                <button
                  class="px-3 py-1.5 rounded-md border border-border font-mono text-[12px] transition-all cursor-pointer
                         {metalKey === key ? 'bg-accent2 text-white font-semibold' : 'bg-transparent text-text-secondary'}"
                  onclick={() => (metalKey = key as 'copper' | 'brass' | 'spc')}
                >
                  {m.name}
                </button>
              {/each}
            </div>
            <button
              class="mt-2 px-3 py-1 rounded-md border border-border font-mono text-[11px]
                     text-text-muted hover:text-text-primary hover:bg-surface cursor-pointer
                     transition-all"
              onclick={() => (showMetalsInfo = true)}
              title="Why SPC barely beats bare OFHC for RF"
            >
              ⓘ  More information — ρ(T) for Cu vs Ag plating
            </button>
          </div>

          {#if metal.hasRRR}
            <div class="mb-3">
              <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-1.5">RRR</div>
              <div class="flex gap-1">
                {#each RRR_OPTIONS as r}
                  <button
                    class="px-3 py-1.5 rounded-md border border-border font-mono text-[12px] transition-all cursor-pointer
                           {rrr === r ? 'bg-accent2 text-white font-semibold' : 'bg-transparent text-text-secondary'}"
                    onclick={() => (rrr = r)}
                  >
                    {r}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <Slider label="Inner-strand AWG"       bind:value={innerAwg}     min={36} max={48} step={1} unit="AWG"
                  presetValue={currentPreset.innerAwg} />
          <Slider label="Outer-strand AWG"       bind:value={outerAwg}     min={36} max={50} step={1} unit="AWG"
                  presetValue={currentPreset.outerAwg} />
          <Slider label="N outer strands"        bind:value={nOuter}       min={8}  max={64} step={1} unit=""
                  presetValue={currentPreset.nOuter} />
          <Slider label="Outer-ring radius (R)"  bind:value={rRing_um}     min={100} max={600} step={1} unit="µm"
                  presetValue={currentPreset.rRing_um} />
          <Slider label="Inner-bundle lay angle" bind:value={layInner_deg} min={0}  max={20} step={1} unit="°"
                  presetValue={currentPreset.layInner_deg} />
          <Slider label="Outer-shield lay angle" bind:value={layOuter_deg} min={0}  max={45} step={1} unit="°"
                  presetValue={currentPreset.layOuter_deg} />
        </div>

        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-accent2 uppercase tracking-[1.5px] mb-3.5 font-semibold">
            Dielectric
          </div>
          <div class="mb-3">
            <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-1.5">Material</div>
            <div class="flex flex-wrap gap-2">
              {#each [
                { k: 'pfa',      label: 'PFA' },
                { k: 'fepSolid', label: 'FEP (solid)' },
                { k: 'fepFoam',  label: 'FEP foam' },
              ] as d}
                <button
                  class="px-3 py-1.5 rounded-md border border-border font-mono text-[12px] transition-all cursor-pointer
                         {dielKey === d.k ? 'bg-accent text-white font-semibold' : 'bg-transparent text-text-secondary'}"
                  onclick={() => (dielKey = d.k as 'pfa' | 'fepFoam' | 'fepSolid')}
                >
                  {d.label}
                </button>
              {/each}
            </div>
          </div>
          {#if dielKey === 'fepFoam'}
            <Slider label="FEP foam fraction"  bind:value={foamFraction}  min={0}  max={0.8} step={0.01} unit=""
                    presetValue={currentPreset.foamFraction} />
          {/if}
          {#if dielectric.note}
            <div class="text-[10px] text-text-muted mt-1 leading-snug">{dielectric.note}</div>
          {/if}
        </div>

        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-accent uppercase tracking-[1.5px] mb-3.5 font-semibold">
            Stranding penalty K_s (per conductor)
          </div>
          <div class="text-[12px] text-text-secondary mb-3 leading-snug">
            Pozar's α_c has independent (1/a) and (1/b) terms — inner and
            outer get their own penalty.  Both formulas are heuristic; the
            <span class="font-mono">correction</span> slider is the
            datasheet-calibration knob (1.0 = trust the formula).
          </div>

          <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-1.5">Inner bundle</div>
          <div class="text-[12px] text-text-secondary mb-1 leading-snug font-mono">
            formula = sec(θ_inner) =
            <span class="font-semibold">{fmt(results.K_s_inner_formula, 3)}</span>
            → in use =
            <span class="font-semibold">{fmt(results.K_s_inner, 3)}</span>
          </div>
          <Slider label="Inner correction" bind:value={K_s_inner_correction}
                  min={0.5} max={3.0} step={0.05} unit="×"
                  presetValue={currentPreset.K_s_inner_correction} />

          <div class="text-[11px] text-text-muted uppercase tracking-[1px] mt-3 mb-1.5">Outer shield</div>
          <div class="text-[12px] text-text-secondary mb-1 leading-snug font-mono">
            formula = max(1, 1/coverage)·sec(θ_outer) =
            <span class="font-semibold">{fmt(results.K_s_outer_formula, 3)}</span>
            → in use =
            <span class="font-semibold">{fmt(results.K_s_outer, 3)}</span>
          </div>
          <Slider label="Outer correction" bind:value={K_s_outer_correction}
                  min={0.5} max={5.0} step={0.05} unit="×"
                  presetValue={currentPreset.K_s_outer_correction} />
        </div>

        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-accent2 uppercase tracking-[1.5px] mb-3.5 font-semibold">
            Operating conditions
          </div>
          <Slider label="Frequency"     bind:value={freqGHz}  min={0.1} max={4.0}  step={0.05} unit="GHz" />
          <Slider label="Cable length"  bind:value={lengthM}  min={0.1} max={3.0}  step={0.05} unit="m" />
        </div>
      </div>

      <!-- Right column: diagram + metrics -->
      <div class="space-y-4">
        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-2 font-semibold">
            Cross-section (to scale)
          </div>
          <CoaxCrossSection
            {rInner} {rOuterStrand} {rRing} {nOuter}
            metalColor={metal.color}
            a={results.a} b={results.b}
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <Metric label="Z₀" value={fmt(results.Z0, 2)} unit="Ω" ok={z0Ok} />
          <Metric
            label={stage === 'calRT' ? 'RF loss (300 K cal)' : 'RF loss'}
            value={fmt(results.totalLoss_dB, 2)}
            unit="dB"
          />
          <Metric
            label="Heat / cable"
            value={stage === 'calRT' ? 'N/A' : fmt(results.Qtotal_uW, 1)}
            unit={stage === 'calRT' ? '' : 'µW'}
          />
        </div>

        {#if stage === 'calRT'}
          <div class="p-[14px] rounded-[10px] border border-accent2 bg-surface text-[12px] text-text-secondary leading-snug">
            <span class="font-semibold text-text-primary">Calibration mode active.</span>
            All properties evaluated at 295 K — heat-load integrals are zero by construction.
            Adjust the outer-correction slider (and inner if you have an independent
            handle) until <span class="font-mono text-text-primary">RF loss</span>
            matches the vendor datasheet at this frequency &amp; length, then switch back to a
            cryo stage. <span class="text-text-muted">The shipped defaults are tuned for
            1–4 GHz against the TCF-3450F IL curve (±10% in band).  A constant K_s can't
            track the cable's measured f^0.72 scaling outside that band, and the RT-tuned
            K_s likely under-predicts cryo loss by ~10–30% at the high end.</span>
          </div>
        {/if}

        <!-- Donut: loss split -->
        <div class="p-[18px] rounded-[10px] border border-border bg-surface">
          <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-2 font-semibold">
            RF loss split @ {fmt(results.Tavg, 2)} K
          </div>
          <div class="flex items-center gap-5">
            <svg viewBox="0 0 100 100" width="120" height="120">
              <path d={donutArc(50, 50, 44, 28, 0, condFrac * 2 * Math.PI)}
                    fill="var(--color-accent2)" opacity="0.85" />
              <path d={donutArc(50, 50, 44, 28, condFrac * 2 * Math.PI, dielFrac * 2 * Math.PI)}
                    fill="var(--color-accent)" opacity="0.75" />
            </svg>
            <div class="flex-1 text-[12px]">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="w-3 h-3 rounded-sm inline-block" style="background:var(--color-accent2)"></span>
                <span class="text-text-secondary flex-1">Conductor</span>
                <span class="font-mono font-semibold">{(condFrac * 100).toFixed(1)}%</span>
                <span class="font-mono text-text-muted text-[11px] w-20 text-right">{fmt(results.alphaCond_dBm, 3)} dB/m</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm inline-block" style="background:var(--color-accent)"></span>
                <span class="text-text-secondary flex-1">Dielectric</span>
                <span class="font-mono font-semibold">{(dielFrac * 100).toFixed(1)}%</span>
                <span class="font-mono text-text-muted text-[11px] w-20 text-right">{fmt(results.alphaDiel_dBm, 3)} dB/m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Datasheet deltas, if any -->
    {#if deltaRows.length > 0}
      <div class="mt-6 p-[16px] rounded-[10px] border border-border bg-surface">
        <div class="text-[11px] text-accent uppercase tracking-[1.5px] mb-2 font-semibold">
          Datasheet cross-check — {currentPreset.name}
        </div>
        <table class="w-full text-[12px] font-mono">
          <tbody>
            {#each deltaRows as [k, v]}
              <tr class="border-b border-border last:border-0">
                <td class="py-1 text-text-secondary">{k}</td>
                <td class="py-1 text-right text-text-primary">{v}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <MetalsInfoModal bind:open={showMetalsInfo} />

    <!-- Full breakdown table -->
    <div class="mt-6 p-[16px] rounded-[10px] border border-border bg-surface">
      <div class="text-[11px] text-accent2 uppercase tracking-[1.5px] mb-2 font-semibold">
        Detailed breakdown
      </div>
      <table class="w-full text-[12px] font-mono">
        <tbody>
          {#each breakdown as row}
            {#if row === null}
              <tr><td colspan="2" class="py-1"></td></tr>
            {:else}
              <tr class="border-b border-border last:border-0">
                <td class="py-1 text-text-secondary">{row[0]}</td>
                <td class="py-1 text-right text-text-primary">{row[1]}</td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
