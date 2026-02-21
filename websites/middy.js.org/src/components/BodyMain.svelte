<script>
import BodyMain from "@design-system/svelte/BodyMain.svelte";

const { children } = $props();
</script>

<BodyMain>
    {@render children?.()}
</BodyMain>
