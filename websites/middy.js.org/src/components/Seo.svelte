<script module>
const SITE_NAME = "Middy.js";
const SITE_ORIGIN = "https://middy.js.org";
const DEFAULT_IMAGE = "/img/middy-og.png";
const DEFAULT_LOGO = "/img/middy-logo.svg";
const AUTHOR_NAME = "Middy contributors";
const AUTHOR_URL = "https://github.com/middyjs";

const absolute = (path) => {
	return new URL(path, SITE_ORIGIN).href;
}

const safeJsonLd = (data) => {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}
</script>
<script>
import { page } from "$app/state";

const {
	title,
	description = "",
	locale = "en-CA",
	type = "website",
	image = DEFAULT_IMAGE,
	schemaType = "WebPage",
	datePublished,
	dateModified,
} = $props();

const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
const url = absolute(page.url?.pathname ?? "/");
const imageUrl = absolute(image);

const jsonLd = {
	"@context": "https://schema.org",
	"@type": schemaType,
	name: title,
	headline: title,
	url,
	image: imageUrl,
	inLanguage: locale,
	isPartOf: {
		"@type": "WebSite",
		name: SITE_NAME,
		url: SITE_ORIGIN,
	},
	author: {
		"@type": "Person",
		name: AUTHOR_NAME,
		url: AUTHOR_URL,
	},
	publisher: {
		"@type": "Organization",
		name: SITE_NAME,
		url: SITE_ORIGIN,
		logo: {
			"@type": "ImageObject",
			url: absolute(DEFAULT_LOGO),
		},
	},
};
if (description) jsonLd.description = description;
if (datePublished) jsonLd.datePublished = datePublished;
if (dateModified) jsonLd.dateModified = dateModified;
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	<meta name="author" content={AUTHOR_NAME} />
	<link rel="canonical" href={url} />

	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={locale} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={fullTitle} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:url" content={url} />
	<meta property="og:image" content={imageUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	<meta name="twitter:image" content={imageUrl} />

	{@html `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`}
</svelte:head>
