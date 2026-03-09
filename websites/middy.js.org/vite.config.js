import { sveltekit } from "@sveltejs/kit/vite";
import { createLogger, defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
//import llms from 'vite-plugin-llms'
import sitemap from "vite-plugin-sitemap";
import sriPrerendered from "vite-plugin-sri";

// TODO remove after vite 8 — https://github.com/vitejs/vite/issues/19498
const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
	if (msg.includes("node:async_hooks")) return;
	originalWarn(msg, options);
};

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
	customLogger: logger,
	ssr: {
		// Required for codeblock SSR
		noExternal: ["prismjs"],
	},
});
