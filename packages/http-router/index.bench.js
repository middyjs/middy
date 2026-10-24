import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const handler = () => {};
	return middy(
		router([
			{ method: "GET", path: "/user", handler },
			{ method: "GET", path: "/user/comments", handler },
			{ method: "GET", path: "/user/avatar", handler },
			{ method: "GET", path: "/user/lookup/username/{username}", handler },
			{ method: "GET", path: "/user/lookup/email/{address}", handler },
			{ method: "GET", path: "/event/{id}", handler },
			{ method: "GET", path: "/event/{id}/comments", handler },
			{ method: "POST", path: "/event/{id}/comment", handler },
			{ method: "GET", path: "/map/{location}/events", handler },
			{ method: "GET", path: "/status", handler },
			{ method: "GET", path: "/very/deeply/nested/route/hello/there", handler },
			{ method: "GET", path: "/static/{proxy+}", handler },
		]),
	);
};

const warmHandler = setupHandler();

// Larger router with many dynamic routes at varied depths, exercises the
// segment-count short-circuit. Worst case is the last-registered route.
const setupBigHandler = () => {
	const h = () => {};
	const routes = [];
	for (let i = 0; i < 20; i++) {
		routes.push({ method: "GET", path: `/a${i}/{x}`, handler: h }); // 2 slashes
		routes.push({ method: "GET", path: `/b${i}/{x}/{y}`, handler: h }); // 3
		routes.push({
			method: "GET",
			path: `/c${i}/{x}/{y}/{z}`,
			handler: h,
		}); // 4
	}
	routes.push({ method: "GET", path: "/target/{id}/last", handler: h }); // 3
	return middy(router(routes));
};
const warmBigHandler = setupBigHandler();

suite("http-router", () => {
	bench("short static", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/user" } },
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("static with same radix", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/user/comments" } },
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("dynamic route", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: {
					http: { method: "GET", path: "/user/lookup/username/john" },
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("mixed static dynamic", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: {
					http: { method: "GET", path: "/event/abcd1234/comments" },
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("long static", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: {
					http: {
						method: "GET",
						path: "/very/deeply/nested/route/hello/there",
					},
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("wildcard", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/static/index.html" } },
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("vpc static no query", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { method: "GET", raw_path: "/user" };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("vpc static with query", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { method: "GET", raw_path: "/user?foo=bar&baz=qux" };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("vpc dynamic no query", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { method: "GET", raw_path: "/user/lookup/username/john" };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("big router: last-registered dynamic (3 segs)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/target/42/last" } },
			};
			try {
				await warmBigHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
