<script>
import BodyHeader from "@design-system/components/BodyHeader.svelte";
import Icon from "@design-system/components/Icon.svelte";
import Image from "@design-system/components/Image.svelte";
import InputSearch from "@design-system/components/InputSearch.svelte";
import A from "@design-system/elements/a.svelte";
import Button from "@design-system/elements/button.svelte";
import Div from "@design-system/elements/div.svelte";
import Form from "@design-system/elements/form.svelte";
import Search from "@design-system/elements/search.svelte";
import Span from "@design-system/elements/span.svelte";
import webComponentUrl from "@willfarrell-ds/vanilla/components/ds-input-focus.js?url&worker";

import { page } from "$app/state";

const { params, data, form } = page;
const { locale, entity, domain, subdomain, modify } = params;

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
            alt="Home"
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
           	<Div role="group">
					<InputSearch id="q" placeholder="Search ⌘+K" size="18" is="ds-input-focus" data-keys="$mod+K" value={form?.q} />
					<!-- <Code>&#8984;</Code><Code>K</Code> -->
					<Button><Icon src="/img/icons.svg#search" /><Span class="visually-hidden">Search</Span></Button>
				</Div>
        </Form></Search>
    {/snippet}
</BodyHeader>
