// TODO convert into adapter
// import * as env from '$env/static/private';
// import { redirect } from "@utils/sveltekit.js";
//import { recommendHttpHeader } from "@utils/recommend.js";
import tardisec from "../../.tardisec.json" with { type: "json" };

const tardisecMiddleware = async ({ event, resolve }) => {
	// const { url, params, cookies } = event;

	const response = await resolve(event);

	const keys = Object.keys(tardisec.http.headers);
	for (let i = keys.length; i--; ) {
		const headerKey = keys[i];
		const headerValue = tardisec.http.headers[headerKey];
		if (headerValue && !response.headers.has(headerKey)) {
			response.headers.set(headerKey, headerValue);
		}
	}

	// Kit can't emit require-trusted-types-for without forcing a trusted-types
	// allowlist at build time, so append it here when absent.
	// error during build:
	// [Error loading svelte.config.js: The `csp.directives['trusted-types']` option must include 'svelte-trusted-html']
	const csp = response.headers.get("Content-Security-Policy");
	if (csp && !csp.includes("require-trusted-types-for")) {
		response.headers.set(
			"Content-Security-Policy",
			`${csp};require-trusted-types-for 'script'`,
		);
	}

	response.headers.delete("X-Sveltekit-Page");

	return response;
};

export default tardisecMiddleware;
