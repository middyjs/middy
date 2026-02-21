<script>
// import bootstrapUrl from "../scripts/bootstrap.js?url";
import "@design-system/style/all.css";
import "@components/theme.css";

import BodyFooter from "@components/BodyFooter.svelte";
import BodyHeader from "@components/BodyHeader.svelte";

const { children } = $props();
//import '@scripts/bootstrap.js'; /* self is not defined */
</script>

<svelte:head>
  <!-- <script src="{bootstrapUrl}?v=" type="module"></script> -->
</svelte:head>

<BodyHeader/>
{@render children?.()}
<BodyFooter/>
