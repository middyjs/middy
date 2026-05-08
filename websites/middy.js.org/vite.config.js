import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import sriPrerendered from "vite-plugin-sri";

export default defineConfig({
	plugins: [
		sveltekit(),
		mkcert({ mkcertPath: "/opt/homebrew/bin/mkcert" }),
		sriPrerendered(),
	],
	build: {
		assetsInlineLimit: 0,
	},
	ssr: {
		// Required for codeblock SSR
		noExternal: ["prismjs"],
	},
	optimizeDeps: {
		exclude: ["@willfarrell-ds/svelte", "@willfarrell-ds/vanilla"],
	},
});
