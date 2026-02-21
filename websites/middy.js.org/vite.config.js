import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
//import llms from 'vite-plugin-llms'
import sitemap from "vite-plugin-sitemap";
//import sriServerSideRendered from '../../../../willfarrell/svelte-sri/vite-plugin.js'
import sriPrerendered from "vite-plugin-sri";

export default defineConfig({
	plugins: [
		sveltekit(),
		mkcert({ mkcertPath: "/opt/homebrew/bin/mkcert" }),
		//sriServerSideRendered(),
		sriPrerendered(),
		//llms(),
		sitemap({ hostname: "https://middy.js.org", outDir: "build/assets/" }),
	],
	build: {
		assetsInlineLimit: 0,
	},
	ssr: {
		// Required for codeblock SSR
		noExternal: ["prismjs"],
	},
});
