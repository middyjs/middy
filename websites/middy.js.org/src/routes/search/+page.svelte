<script>
import Card from "@design-system/svelte/Card.svelte";
import A from "@design-system/svelte/element/a.svelte";
import Li from "@design-system/svelte/element/li.svelte";
import P from "@design-system/svelte/element/p.svelte";
import Section from "@design-system/svelte/element/section.svelte";
import Span from "@design-system/svelte/element/span.svelte";
import Ul from "@design-system/svelte/element/ul.svelte";
import H1 from "@design-system/svelte/Heading1.svelte";
import H3 from "@design-system/svelte/Heading3.svelte";
import LayoutCenter from "@design-system/svelte/LayoutCenter.svelte";
import { page } from "$app/state";

const { data } = page;
const { results } = data;
</script>

<svelte:head>
    <title>Search | Middy.js</title>
    <!-- <meta name="description" content="" /> -->
</svelte:head>
<LayoutCenter>
    <Section>
        <H1>Search results</H1>
        {#if results.length}
            <Ul class="grid">
                {#each results as card}
                    <Card id={card.id}>
                        <H3
                            ><A href={card.href} aria-describedby={card.id}
                                >{card.title}</A
                            ></H3
                        >
                        {#if card.description}
                            <P>{@html card.description}</P>
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
