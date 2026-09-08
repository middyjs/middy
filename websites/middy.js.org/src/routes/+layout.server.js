import pkg from "../../package.json" with { type: "json" };

export const prerender = false;
export const ssr = true;
export const csr = false;

export async function load({ request }) {
	return {
		version: pkg.version,
		// Cloudflare request id, surfaced on the 500 page and in handleError logs.
		requestId: request.headers.get("cf-ray"),
	};
}
