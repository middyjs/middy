<script module>
const SITE_NAME = "Middy.js";
const SITE_ORIGIN = "https://middy.js.org";
const DEFAULT_IMAGE = "/img/middy-og.png";
const DEFAULT_LOGO = "/img/middy-logo.svg";
const AUTHOR_NAME = "Middy contributors";
const AUTHOR_URL = "https://github.com/middyjs";
const REPO_URL = "https://github.com/middyjs/middy";
const NPM_URL = "https://www.npmjs.com/package/@middy/core";

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
	includeSoftwareApplication = false,
} = $props();

const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
const url = absolute(page.url?.pathname ?? "/");
const imageUrl = absolute(image);

const pageJsonLd = {
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
		"@type": "Organization",
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
if (description) pageJsonLd.description = description;
if (datePublished) pageJsonLd.datePublished = datePublished;
if (dateModified) pageJsonLd.dateModified = dateModified;

const softwareJsonLd = includeSoftwareApplication
	? {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"@id": `${SITE_ORIGIN}#middy`,
		name: "Middy",
		alternateName: ["@middy/core", "middy.js"],
		applicationCategory: "DeveloperApplication",
		applicationSubCategory: "AWS Lambda middleware engine",
		operatingSystem: "AWS Lambda (Node.js)",
		runtimePlatform: "Node.js >= 22",
		programmingLanguage: ["JavaScript", "TypeScript"],
		url: SITE_ORIGIN,
		downloadUrl: NPM_URL,
		codeRepository: REPO_URL,
		license: "https://opensource.org/licenses/MIT",
		isAccessibleForFree: true,
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		author: {
			"@type": "Organization",
			name: AUTHOR_NAME,
			url: AUTHOR_URL,
		},
		image: imageUrl,
		description:
			"Middy is a stylish Node.js middleware engine for AWS Lambda. Compose reusable middlewares for parsing, validation, auth, observability, error handling, and AWS service integration. 38 official packages, first-class TypeScript types, ESM, streamify-response and durable-function compatible.",
		keywords: [
			"AWS Lambda",
			"middleware",
			"serverless",
			"Node.js",
			"TypeScript",
			"API Gateway",
			"SQS",
			"DynamoDB",
			"S3",
			"SNS",
			"EventBridge",
			"WebSocket",
			"JWT",
			"validation",
			"observability",
			"Powertools",
		],
	}
	: null;
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

	{@html `<script type="application/ld+json">${safeJsonLd(pageJsonLd)}</script>`}
	{#if softwareJsonLd}
		{@html `<script type="application/ld+json">${safeJsonLd(softwareJsonLd)}</script>`}
	{/if}
</svelte:head>
