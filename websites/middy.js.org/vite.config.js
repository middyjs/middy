import { resolve } from "node:path";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { mdsvex } from "mdsvex";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import sriPrerendered from "vite-plugin-sri";
import tardisec from "./.tardisec.sveltekit.json" with { type: "json" };
import { rehypeAddHeadingIds } from "./src/lib/rehype-add-heading-ids.js";
import { rehypeCopyPre } from "./src/lib/rehype-copy-pre.js";
import { remarkExtractHeadings } from "./src/lib/remark-extract-headings.js";
import { remarkMermaid } from "./src/lib/remark-mermaid.js";

const domain = process.env.ORIGIN ?? "middy.js.org";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({}),
			appDir: "_",
			csp: tardisec.kit.csp,
			// Also the CSRF trusted origin and prerender url.origin
			paths: {
				origin: `https://${domain}`,
			},
			prerender: {
				concurrency: 5,
				crawl: false,
				entries: [
					"/sitemap.xml",
					"/llms.txt",
					"/llms-full.txt",
					"/search.json",
				],
				handleHttpError: "warn", // 'fail'
				handleMissingId: "warn", // 'fail'
				handleEntryGeneratorMismatch: "warn", // 'fail'
			},
			preprocess: [
				mdsvex({
					extensions: [".md"],
					smartypants: false,
					layout: {
						_: resolve("./src/components/docs/mdsvex-layout.svelte"),
					},
					remarkPlugins: [remarkExtractHeadings, remarkMermaid],
					rehypePlugins: [rehypeAddHeadingIds, rehypeCopyPre],
				}),
			],
			extensions: [".svelte", ".md"],
			onwarn(warning, defaultHandler) {
				// polyfill for `is` included, allow
				if (warning.code === "attribute_avoid_is") return;

				// false-positive Triggers on non-reactive "is updated, but is not declared with `$state(...)`. Changing its value will not correctly trigger updates""
				if (warning.code === "non_reactive_update") return;

				warning.message = `[${warning.code}] ${warning.message}`;
				defaultHandler(warning);
			},
		}),
		mkcert({ mkcertPath: "/opt/homebrew/bin/mkcert" }),
		sriPrerendered(),
	],
	build: {
		assetsInlineLimit: 0,
	},
	optimizeDeps: {
		exclude: ["@willfarrell-ds/svelte", "@willfarrell-ds/vanilla"],
		// ds-codeblock imports prismjs (CJS), excluded packages skip that interop
		include: ["prismjs"],
	},
});
