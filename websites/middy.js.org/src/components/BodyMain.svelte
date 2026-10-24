<script>
import BodyMain from "@willfarrell-ds/svelte/components/BodyMain.svelte";

const { children } = $props();
</script>

<BodyMain>
    {@render children?.()}
</BodyMain>
