import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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

// Larger router with many dynamic routes at varied depths — exercises the
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

await bench
	.add(
		"short static",
		async (
			event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/user" } },
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"static with same radix",
		async (
			event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/user/comments" } },
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"dynamic route",
		async (
			event = {
				version: "2.0",
				requestContext: {
					http: { method: "GET", path: "/user/lookup/username/john" },
				},
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"mixed static dynamic",
		async (
			event = {
				version: "2.0",
				requestContext: {
					http: { method: "GET", path: "/event/abcd1234/comments" },
				},
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"long static",
		async (
			event = {
				version: "2.0",
				requestContext: {
					http: {
						method: "GET",
						path: "/very/deeply/nested/route/hello/there",
					},
				},
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"wildcard",
		async (
			event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/static/index.html" } },
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"vpc static no query",
		async (event = { method: "GET", raw_path: "/user" }) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"vpc static with query",
		async (event = { method: "GET", raw_path: "/user?foo=bar&baz=qux" }) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"vpc dynamic no query",
		async (
			event = { method: "GET", raw_path: "/user/lookup/username/john" },
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"big router: last-registered dynamic (3 segs)",
		async (
			event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/target/42/last" } },
			},
		) => {
			try {
				await warmBigHandler(event, defaultContext);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
