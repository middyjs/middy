<script>
import H1 from "@design-system/components/Heading1.svelte";
import Image from "@design-system/components/Image.svelte";
import Div from "@design-system/elements/div.svelte";
import Main from "@design-system/elements/main.svelte";
import P from "@design-system/elements/p.svelte";
import { page } from "$app/state";

const message = $derived(page.error?.message ?? "An error occurred");
// cf-ray header, provided by the root layout load (null outside Cloudflare)
const requestId = $derived(page.data?.requestId ?? null);
</script>

<svelte:head>
    <title>{page.status} {message} | Middy.js</title>
</svelte:head>

<Main id="main" class="container-error">
    <Div>
        <Image
            src="/img/middy-logo.svg"
            alt="Middy"
            height="74"
            width="162"
            decoding="auto"
            fetchpriority="high"
            loading="eager"
        />
        <H1>{page.status}</H1>
        <P>{message}</P>
        {#if page.status === 500 && requestId}
            <P>Request ID: {requestId}</P>
        {/if}
    </Div>
</Main>

<style>
    :global(html) {
        height: 100%;
    }
    :global(body) {
        height: 100%;
    }
    :global(main.container-error) {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;

        & div {
            width: 40ch;
            text-align: center;
        }
        & span {
            padding: 0 1rem 1rem 1rem;
            white-space: nowrap;
        }
    }
</style>
