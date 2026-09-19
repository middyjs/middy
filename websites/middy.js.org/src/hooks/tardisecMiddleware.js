// TODO convert into adapter
// import * as env from '$env/static/private';
// import { redirect } from "@utils/sveltekit.js";
//import { recommendHttpHeader } from "@utils/recommend.js";
import { isRedirect } from "@sveltejs/kit";
import tardisec from "../../.tardisec.json" with { type: "json" };

// Kit encodes a redirect differently for these two, so let its own handler build
// those responses: a client-side navigation reads a `__data.json` redirect as JSON,
// and a fetch-submitted form action reads an `x-sveltekit-action` one. Both are 200s
// the browser never follows, so neither is a scan surface.
const kitOwnsRedirect = (event) =>
	event.url?.pathname?.endsWith("/__data.json") ||
	event.request?.headers?.get("x-sveltekit-action") === "true";

const tardisecMiddleware = async ({ event, resolve }) => {
	// const { url, params, cookies } = event;

	// redirect() throws, and a throw unwinds past every hook wrapping the thrower
	// straight to Kit's own handler, so the 3xx shipped with none of these headers and
	// every scan of `/` graded the redirect rather than the page it points at. Move this
	// hook first in the sequence() if another hook is ever added that redirects.
	let response;
	try {
		response = await resolve(event);
	} catch (e) {
		if (!isRedirect(e) || kitOwnsRedirect(event)) throw e;
		response = new Response(null, {
			status: e.status,
			headers: { location: e.location },
		});
	}

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
