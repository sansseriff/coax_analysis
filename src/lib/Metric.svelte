<script lang="ts">
  let {
    label, value, unit, ok = null, warn = null,
  }: {
    label: string; value: string; unit: string; ok?: boolean | null; warn?: string | null;
  } = $props();
</script>

<div
  class="px-3.5 py-2.5 rounded-lg border"
  style="background: {ok === false ? 'var(--color-warn-bg)' : ok === true ? 'var(--color-ok-bg)' : 'var(--color-surface)'};
         border-color: {ok === false ? 'var(--color-warn-border)' : ok === true ? 'var(--color-ok-border)' : 'var(--color-border)'};"
>
  <div class="text-[11px] text-text-muted uppercase tracking-[1px] mb-0.5">{label}</div>
  <div
    class="text-[22px] font-bold font-mono"
    style="color: {ok === false ? 'var(--color-warn)' : ok === true ? 'var(--color-ok)' : 'var(--color-text-primary)'};"
  >
    {value} <span class="text-[12px] font-normal text-text-secondary">{unit}</span>
  </div>
  {#if warn}
    <div class="text-[11px] mt-0.5" style="color: var(--color-warn);">{warn}</div>
  {/if}
</div>
