/* eslint-env browser */
/* global trustedTypePolicy */
const d = document;
const w = window;
const n = navigator;

w.addEventListener("load", async () => {
	if ("serviceWorker" in n) {
		const sw = n.serviceWorker;
		const reg = await sw.register(trustedTypePolicy.createScriptURL("/sw.js"), {
			scope: "/",
		});
		await sw.ready;

		sw.addEventListener("message", async (event) => {
			console.log("ServiceWorker.message", event);
			if (!reg.active) return;
			if (event.origin !== location.origin) return;
			await swEvents?.[event.type]?.();
		});

		const swEvents = {};

		const broadcastActivity = new BroadcastChannel("inactivity");
		const activityEvents = [
			"load",
			// 'click', // duplicate of mousedown
			"keypress",
			"mousedown",
			"mousemove",
			"scroll",
			"touchmove",
			"touchstart",
			"visibilitychange",
			"wheel",
		];
		let activityTimestamp = 0;
		activityEvents.forEach((name) => {
			d.addEventListener(
				name,
				() => {
					// console.log(event.type)
					const now = Date.now();
					if (activityTimestamp + 1000 > now) {
						return;
					}
					activityTimestamp = now;
					broadcastActivity.postMessage({
						type: "activity",
					});
				},
				true,
			);
		});
		broadcastActivity.onmessage = (event) => {
			if (event.data?.type === "inactivity") {
				if (location.pathname.includes("/")) {
					const locale = location.pathname.split("/").slice(1, 2);
					location.href = `${location.origin}/${locale}/logout/expire?r=${encodeURIComponent(location.pathname + location.search)}`;
				}
			}
		};

		d.addEventListener("ononline", () => {
			sw.controller?.postMessage?.({
				type: "online",
			});
		});
	}
});
