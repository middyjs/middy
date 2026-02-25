/* eslint-env browser */
/* global v */
// Load WebComponents on demand
// https://github.com/ungap/custom-elements
// https://bugs.webkit.org/show_bug.cgi?id=182671
// https://github.com/WebKit/standards-positions/issues/97
// https://caniuse.com/mdn-api_customelementregistry_builtin_element_support

if (!self.customElements) {
	import("/js/polyfill/custom-elements.js?url");
}
const d = document;
const lazyLoad = new IntersectionObserver(async (entries, observer) => {
	for (const { target, isIntersecting } of entries) {
		if (isIntersecting) {
			// don't `await` to ensure non-blocking
			import(
				/* @vite-ignore */
				`/js/pewc/${target.getAttribute("is")}.js?v=${v}`
			);
		}
	}
});
d.querySelectorAll("[is]").forEach((el) => {
	lazyLoad.observe(el);
});
