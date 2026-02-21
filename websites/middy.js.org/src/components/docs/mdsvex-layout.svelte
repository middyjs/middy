<script>
import A from "@design-system/svelte/element/a.svelte";
import Header from "@design-system/svelte/element/header.svelte";
import Hgroup from "@design-system/svelte/element/hgroup.svelte";
import Li from "@design-system/svelte/element/li.svelte";
import Ol from "@design-system/svelte/element/ol.svelte";
import Section from "@design-system/svelte/element/section.svelte";
import H1 from "@design-system/svelte/Heading1.svelte";
import H2 from "@design-system/svelte/Heading2.svelte";
import LayoutAside from "@design-system/svelte/LayoutAside.svelte";
import LayoutTableOfContents from "@design-system/svelte/LayoutTableOfContents.svelte";
import NavScrollspy from "@design-system/svelte/NavScrollspy.svelte";
import AsideNav from "./AsideNav.svelte";

const { title = "Documentation", headings = [], children } = $props();
</script>
<svelte:head>
	<title>{title} | Middy.js</title>
	<!-- <meta name="description" content="" /> -->
</svelte:head>
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
			<Section>
				<Header><H2>On this page</H2></Header>
				<Ol>
					{#if headings.length > 0}
						{#each headings as heading}
							<Li><A href="#{heading.id}">{heading.text}</A></Li>
						{/each}
					{/if}
				</Ol>
			</Section>
		</NavScrollspy>
    {/snippet}
	{@render children?.()}
</LayoutTableOfContents>
</LayoutAside>
