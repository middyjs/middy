<script>
import Seo from "@components/Seo.svelte";
import Card from "@design-system/components/Card.svelte";
import H1 from "@design-system/components/Heading1.svelte";
import H2 from "@design-system/components/Heading2.svelte";
import LayoutCenter from "@design-system/components/LayoutCenter.svelte";
import A from "@design-system/elements/a.svelte";
import Mark from "@design-system/elements/mark.svelte";
import P from "@design-system/elements/p.svelte";
import Section from "@design-system/elements/section.svelte";
import Span from "@design-system/elements/span.svelte";
import Ul from "@design-system/elements/ul.svelte";
import { page } from "$app/state";

const { data } = page;
const { results } = data;
</script>

<Seo
    title="Search"
    description="Search the Middy.js documentation for middlewares, events, and guides."
/>
<LayoutCenter>
    <Section>
        <H1>Search results</H1>
        {#if results.length}
            <Ul class="grid">
                {#each results as card}
                    <Card id={card.id}>
                        <H2
                            ><A href={card.href} aria-describedby={card.id}
                                >{card.title}</A
                            ></H2
                        >
                        {#if card.description}
                            <!-- segments are plain text; Svelte escapes them, matches get <mark> -->
                            <P>{#each card.description as segment}{#if segment.match}<Mark>{segment.text}</Mark>{:else}{segment.text}{/if}{/each}</P>
                        {/if}
                        {#if card.button}
                            <Span aria-hidden="true" id={card.id}
                                >{card.button}</Span
                            >
                        {/if}
                    </Card>
                {/each}
            </Ul>
        {:else}
            <P>No pages found.</P>
        {/if}
    </Section>
</LayoutCenter>
