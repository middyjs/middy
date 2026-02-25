/* eslint-env browser */
/* global trustedTypes */

// import DOMPurify from 'dompurify'

let trustedTypePolicy = {
	createHTML: (string) => string,
	createScriptURL: (string) => string,
	createScript: (string) => {
		const url = new URL(string);
		// Only allow same-origin
		return url.pathname + url.hash + url.search;
	},
};
if (typeof trustedTypes !== "undefined") {
	trustedTypePolicy = trustedTypes.createPolicy("_", {
		...trustedTypePolicy,
		// Disabled, only trusted sources used
		// createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) // 9kb br :(
	});
}

globalThis.trustedTypePolicy = trustedTypePolicy;
