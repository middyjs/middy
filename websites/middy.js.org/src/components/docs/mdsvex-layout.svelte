<script>
import Seo from "@components/Seo.svelte";
import Callout from "@design-system/components/Callout.svelte";
import H1 from "@design-system/components/Heading1.svelte";
import LayoutAside from "@design-system/components/LayoutAside.svelte";
import LayoutTableOfContents from "@design-system/components/LayoutTableOfContents.svelte";
import NavScrollspy from "@design-system/components/NavScrollspy.svelte";
import A from "@design-system/elements/a.svelte";
import Hgroup from "@design-system/elements/hgroup.svelte";
import Li from "@design-system/elements/li.svelte";
import Ol from "@design-system/elements/ol.svelte";
import P from "@design-system/elements/p.svelte";
import { page } from "$app/state";
import { getLastUpdated } from "$lib/docs-content.js";
import AsideNav from "./AsideNav.svelte";

const { title = "Documentation", description = "", headings = [], status, children } = $props();

const dateModified = $derived(getLastUpdated(page.url?.pathname ?? ""));
const dateModifiedDisplay = $derived(dateModified ? new Date(dateModified).toISOString().slice(0, 10) : null);
</script>
<Seo
	{title}
	{description}
	type="article"
	schemaType="TechArticle"
	{dateModified}
/>
<LayoutAside>
    {#snippet aside()}
      <AsideNav />
    {/snippet}
<LayoutTableOfContents>
    {#snippet header()}
		<Hgroup>
			<H1>{title}</H1>
		</Hgroup>
    {/snippet}
    {#snippet aside()}
		<NavScrollspy>
			<Ol>
				{#if headings.length > 0}
					{#each headings as heading}
						<Li><A href="#{heading.id}">{heading.text}</A></Li>
					{/each}
				{/if}
			</Ol>
		</NavScrollspy>
    {/snippet}
	{#if status === 'alpha'}
		<Callout label="Alpha">
			This is a new middleware with limited real-world testing. Your feedback is valuable. Please <A href="https://github.com/middyjs/middy/issues">report any issues</A> you encounter. Not recommended for production use just yet.
		</Callout>
	{/if}
	{@render children?.()}
	{#if dateModifiedDisplay}
		<P class="last-updated"><small>Last updated: <time datetime={dateModified}>{dateModifiedDisplay}</time></small></P>
	{/if}
</LayoutTableOfContents>
</LayoutAside>
