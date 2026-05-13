<script lang="ts">
  let {
    label, value = $bindable(), min, max, step, unit, presetValue,
  }: {
    label: string; value: number; min: number; max: number; step: number; unit: string;
    presetValue?: number;
  } = $props();

  // Highlighted when the slider matches the active preset.  Allow a half-step
  // tolerance so step-quantised floats don't drop the highlight spuriously.
  let atPreset = $derived(
    presetValue !== undefined && Math.abs(value - presetValue) < 0.5 * step,
  );
</script>

<div
  class="mb-3.5 pl-2 -ml-2 border-l-2 transition-colors duration-200
         {atPreset ? 'border-accent' : 'border-transparent'}"
>
  <div class="flex justify-between items-baseline font-mono text-[13px] mb-1">
    <span
      class="flex items-center gap-1.5 transition-colors duration-200
             {atPreset ? 'text-accent' : 'text-text-secondary'}"
    >
      {label}
      {#if atPreset}
        <span
          class="text-[9px] uppercase tracking-wider px-1 py-px rounded
                 border border-accent text-accent leading-none"
        >
          preset
        </span>
      {/if}
    </span>
    <span
      class="font-semibold transition-colors duration-200
             {atPreset ? 'text-accent' : 'text-text-primary'}"
    >
      {value} {unit}
    </span>
  </div>
  <input
    type="range"
    {min} {max} {step}
    bind:value
    class="w-full"
  />
</div>
