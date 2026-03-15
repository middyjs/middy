<script>
import "@styles/above.css";

import BodyFooter from "@components/BodyFooter.svelte";
import BodyHeader from "@components/BodyHeader.svelte";
import bootstrapUrl from "@scripts/bootstrap.js?worker&url";
import belowStyles from "@styles/below.css?url";
import printStyles from "@styles/print.css?url";

const { children } = $props();
</script>

<svelte:head>
    <link rel="preload stylesheet" as="style" href="{belowStyles}" />
    <script src={bootstrapUrl} type="module"></script>
    <link rel="stylesheet" media="print" href="{printStyles}" />
</svelte:head>

<BodyHeader/>
{@render children?.()}
<BodyFooter/>
