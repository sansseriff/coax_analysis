<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { SLIDES } from '$lib/slides';

	onMount(() => {
		goto(SLIDES[0], { replaceState: true });
	});
</script>

<noscript>
	<p style="padding: 2rem; font-family: sans-serif;">
		Open the deck at <a href="/slide_0">/slide_0</a>.
	</p>
</noscript>
