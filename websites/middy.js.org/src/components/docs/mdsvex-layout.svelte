<script>
import Callout from "@willfarrell-ds/svelte/components/Callout.svelte";
import H1 from "@willfarrell-ds/svelte/components/Heading1.svelte";
import LayoutAside from "@willfarrell-ds/svelte/components/LayoutAside.svelte";
import LayoutTableOfContents from "@willfarrell-ds/svelte/components/LayoutTableOfContents.svelte";
import NavScrollspy from "@willfarrell-ds/svelte/components/NavScrollspy.svelte";
import A from "@willfarrell-ds/svelte/elements/a.svelte";
import Hgroup from "@willfarrell-ds/svelte/elements/hgroup.svelte";
import Li from "@willfarrell-ds/svelte/elements/li.svelte";
import Ol from "@willfarrell-ds/svelte/elements/ol.svelte";
import P from "@willfarrell-ds/svelte/elements/p.svelte";
import copyPreUrl from "@willfarrell-ds/vanilla/components/ds-copy-pre.js?worker&url";
import Seo from "#components/Seo.svelte";
import { getLastUpdated } from "#lib/docs-content.js";
import { page } from "$app/state";
import AsideNav from "./AsideNav.svelte";

const { title = "Documentation", description = "", headings = [], status, children } = $props();

const dateModified = $derived(getLastUpdated(page.url?.pathname ?? ""));
const dateModifiedDisplay = $derived(dateModified ? new Date(dateModified).toISOString().slice(0, 10) : null);

// Doc pages under these categories map 1:1 to a package directory (slug === package name),
// except for these index/landing pages which are not packages.
const packageCategories = new Set(["middlewares", "routers", "handlers"]);
const nonPackageSlugs = new Set(["intro", "third-party"]);
const sourceUrl = $derived.by(() => {
	const segments = (page.url?.pathname ?? "").split("/").filter(Boolean);
	if (segments[0] !== "docs" || segments.length !== 3) return null;
	const [, category, slug] = segments;
	if (!packageCategories.has(category) || nonPackageSlugs.has(slug)) return null;
	return `https://github.com/middyjs/middy/tree/main/packages/${slug}`;
});
</script>
<svelte:head>
	<link rel="modulepreload" href={copyPreUrl} />
</svelte:head>
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
			{#if sourceUrl}
				<P class="source-link"><small><A href={sourceUrl}>View source on GitHub</A></small></P>
			{/if}
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
