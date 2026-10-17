<script>
import BodyHeader from "@willfarrell-ds/svelte/components/BodyHeader.svelte";
import Icon from "@willfarrell-ds/svelte/components/Icon.svelte";
import Image from "@willfarrell-ds/svelte/components/Image.svelte";
import InputSearch from "@willfarrell-ds/svelte/components/InputSearch.svelte";
import A from "@willfarrell-ds/svelte/elements/a.svelte";
import Button from "@willfarrell-ds/svelte/elements/button.svelte";
import Div from "@willfarrell-ds/svelte/elements/div.svelte";
import Form from "@willfarrell-ds/svelte/elements/form.svelte";
import Search from "@willfarrell-ds/svelte/elements/search.svelte";
import Span from "@willfarrell-ds/svelte/elements/span.svelte";
import webComponentUrl from "@willfarrell-ds/vanilla/components/ds-input-focus.js?worker&url";

import { page } from "$app/state";

const { data, form } = page;

const navTopLinks = {
	[`v${data.version}`]: true,
	GitHub: `https://github.com/middyjs/middy`,
};

const navStartLinks = {
	Documentation: "/docs",
	Middlewares: "/docs/middlewares/intro",
	Events: "/docs/events/intro",
};
const navEndLinks = null; // {};
const navPrimary = null; //{};
</script>

<svelte:head>
  <link rel="modulepreload" href={webComponentUrl} />
</svelte:head>

<BodyHeader {navTopLinks} {navStartLinks} {navEndLinks} {navPrimary}>
    {#snippet start()}
        <A href="/">
          <Image
            src="/img/middy-logo-name.svg"
            alt="Middy logo, to the homepage"
            height="48"
            width="110"
            decoding="auto"
            fetchpriority="high"
            loading="eager"
          />
        </A>
    {/snippet}
    {#snippet end()}
        <Search>
        <Form method="GET" action="/search">
           	<Div class="group">
					<InputSearch id="q" placeholder="Search ⌘+K" size="18" is="ds-input-focus" data-keys="$mod+K" value={form?.q ?? ""} />
					<!-- <Code>&#8984;</Code><Code>K</Code> -->
					<Button type="submit"><Icon src="/img/icons.svg#search" /><Span class="visually-hidden">Search</Span></Button>
				</Div>
        </Form></Search>
    {/snippet}
</BodyHeader>
