import { resolve } from "node:path";
import adapter from "@sveltejs/adapter-cloudflare";
import { mdsvex } from "mdsvex";
import tardisec from "./.tardisec.sveltekit.json" with { type: "json" };
import { rehypeAddHeadingIds } from "./src/lib/rehype-add-heading-ids.js";
import { rehypeCopyPre } from "./src/lib/rehype-copy-pre.js";
import { remarkExtractHeadings } from "./src/lib/remark-extract-headings.js";

// import preprocess from 'svelte-preprocess'

const domain = process.env.ORIGIN ?? "middy.js.org";
const origin = domain;
const config = {
	kit: {
		adapter: adapter({}),
		alias: {
			"@design-system": resolve("../../node_modules/@willfarrell-ds/svelte"),
			"@components": resolve("./src/components"),
			"@hooks": resolve("./src/hooks"),
			"@scripts": resolve("./src/scripts"),
			"@styles": resolve("./src/styles"),
		},
		appDir: "_",
		csp: tardisec.kit.csp,
		csrf: {
			trustedOrigins: [origin],
		},
	},
	preprocess: [
		mdsvex({
			extensions: [".md"],
			smartypants: false,
			layout: {
				_: resolve("./src/components/docs/mdsvex-layout.svelte"),
			},
			remarkPlugins: [remarkExtractHeadings],
			rehypePlugins: [rehypeAddHeadingIds, rehypeCopyPre],
		}),
	],
	extensions: [".svelte", ".md"],
	prerender: {
		concurrency: 5,
		crawl: false,
		entries: ["/", "/sitemap.xml", "/llms.txt", "/llms-full.txt"],
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
