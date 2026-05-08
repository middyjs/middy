<script>
import BodyMain from "@design-system/components/BodyMain.svelte";

const { children } = $props();
</script>

<BodyMain>
    {@render children?.()}
</BodyMain>
