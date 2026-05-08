// TODO convert into adapter
// import * as env from '$env/static/private';
// import { redirect } from "@utils/sveltekit.js";
//import { recommendHttpHeader } from "@utils/recommend.js";
import tardisec from "../../tardisec.json" with { type: "json" };

const tardisecMiddleware = async ({ event, resolve }) => {
	// const { url, params, cookies } = event;

	const response = await resolve(event);

	const keys = Object.keys(tardisec.raw);
	for (let i = keys.length; i--; ) {
		const headerKey = keys[i];
		const headerValue = tardisec.raw[headerKey];
		if (headerValue && !response.headers.has(headerKey)) {
			response.headers.set(headerKey, headerValue);
		}
	}

	response.headers.delete("X-Sveltekit-Page");

	return response;
};

export default tardisecMiddleware;
