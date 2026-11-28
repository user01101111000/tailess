<script lang="ts">
	import * as s from "../lib/page.styles";

	let open = $state(false);
	const parts = $derived(s.panel({ tone: open ? "warn" : "info" }));
</script>

<main class={s.page}>
	<h1 class={s.title}>tailess on SvelteKit</h1>
	<button
		type="button"
		class={s.toggle}
		data-state={open ? "open" : "closed"}
		onclick={() => (open = !open)}
	>
		{open ? "Close" : "Open"}
	</button>
	<section class={parts.root}>
		<h2 class={parts.heading}>Rendered on the server, built again in the browser</h2>
		<p class={s.note(open)}>Every class on this page comes from src/lib/page.styles.ts.</p>
	</section>
</main>
