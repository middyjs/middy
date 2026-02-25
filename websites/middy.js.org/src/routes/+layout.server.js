import pkg from "../../package.json" with { type: "json" };

export const prerender = false;
export const ssr = true;
export const csr = false;

export async function load() {
	return {
		version: pkg.version,
	};
}
