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

	response.headers.delete("X-Sveltekit-Page");

	// Kit can't emit require-trusted-types-for without forcing a trusted-types
	// allowlist at build time, so append it here when absent.
	// error during build:
	// [Error loading svelte.config.js: The `csp.directives['trusted-types']` option must include 'svelte-trusted-html']
	for (const header of [
		"Content-Security-Policy",
		"Content-Security-Policy-Report-Only",
	]) {
		const csp = response.headers.get(header);
		if (csp && !csp.includes("require-trusted-types-for")) {
			response.headers.set(header, `${csp};require-trusted-types-for 'script'`);
		}
	}

	return response;
};

export default tardisecMiddleware;
