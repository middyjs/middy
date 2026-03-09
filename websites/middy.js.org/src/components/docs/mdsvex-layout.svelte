<script>
import H1 from "@design-system/components/Heading1.svelte";
import H2 from "@design-system/components/Heading2.svelte";
import LayoutAside from "@design-system/components/LayoutAside.svelte";
import LayoutTableOfContents from "@design-system/components/LayoutTableOfContents.svelte";
import NavScrollspy from "@design-system/components/NavScrollspy.svelte";
import A from "@design-system/elements/a.svelte";
import Header from "@design-system/elements/header.svelte";
import Hgroup from "@design-system/elements/hgroup.svelte";
import Li from "@design-system/elements/li.svelte";
import Ol from "@design-system/elements/ol.svelte";
import Section from "@design-system/elements/section.svelte";
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
