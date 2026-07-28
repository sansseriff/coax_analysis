<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Cryo Micro-Coax — Loss &amp; Heat Projections</title>
</svelte:head>

<div style="height: 100vh; display: flex; flex-direction: column;">
	{@render children()}
</div>
