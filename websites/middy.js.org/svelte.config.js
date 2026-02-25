import { resolve } from "node:path";
import adapter from "@sveltejs/adapter-cloudflare";
import { mdsvex } from "mdsvex";
import { rehypeAddHeadingIds } from "./src/lib/rehype-add-heading-ids.js";
import { remarkExtractHeadings } from "./src/lib/remark-extract-headings.js";
import tardisec from "./tardisec.json" with { type: "json" };

// import preprocess from 'svelte-preprocess'

const domain = process.env.ORIGIN ?? "middy.js.org";
const origin = domain;
const config = {
	kit: {
		adapter: adapter({}),
		alias: {
			"@design-system": resolve(
				"../../../../willfarrell/design-system/packages",
			),
			"@components": resolve("./src/components"),
			"@hooks": resolve("./src/hooks"),
		},
		appDir: "_",
		csp: {
			...tardisec["svelte.config.js"]["Content-Security-Policy"],
			mode: "hash",
			directives: {
				"default-src": ["none"], // 'report-sha256'
				"base-uri": ["none"],
				"connect-src": ["self"],
				"form-action": ["self"],
				"frame-ancestors": ["none"],
				"img-src": ["self"],
				"manifest-src": ["self"],
				"script-src": ["self"],
				"script-src-attr": ["report-sample"],
				//"script-src-elem": ['self'],
				"style-src": ["self"],
				"style-src-attr": ["report-sample"],
				//"style-src-elem": ['self'],
				//'trusted-types':[],
				//'require-trusted-types-for': ['script'],
				"upgrade-insecure-requests": true,
				"worker-src": ["self"],
				"report-to": ["default"],
				//'report-uri': [`https://${domain}.report-to.org`]
			},
		},
		csrf: {
			trustedOrigins: [origin],
		},
	},
	preprocess: [
		mdsvex({
			extensions: [".md"],
			layout: {
				_: resolve("./src/components/docs/mdsvex-layout.svelte"),
			},
			remarkPlugins: [remarkExtractHeadings],
			rehypePlugins: [rehypeAddHeadingIds],
		}),
	],
	extensions: [".svelte", ".md"],
	prerender: {
		concurrency: 5,
		crawl: false,
		entries: ["/", "/rss.xml", "/atom.xml", "/sitemap.xml"],
		handleHttpError: "warn", // 'fail'
		handleMissingId: "warn", // 'fail'
		handleEntryGeneratorMismatch: "warn", // 'fail'
		origin: `https://${origin}`,
	},
	onwarn(warning, defaultHandler) {
		// polyfill for `is` included, allow
		if (warning.code === "attribute_avoid_is") return;

		// false-positive Triggers on non-reactive "is updated, but is not declared with `$state(...)`. Changing its value will not correctly trigger updates""
		if (warning.code === "non_reactive_update") return;

		warning.message = `[${warning.code}] ${warning.message}`;
		defaultHandler(warning);
	},
};

export default config;
