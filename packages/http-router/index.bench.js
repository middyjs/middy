import { bench } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const operations = 1_000;

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

// The router writes pathParameters onto the event, so every invocation needs
// its own.
const route = (handler, makeEvent) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await handler(makeEvent(), defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

const httpEvent = (method, path) => () => ({
	version: "2.0",
	requestContext: { http: { method, path } },
});
const vpcEvent = (method, raw_path) => () => ({ method, raw_path });

bench(
	"http-router: short static",
	route(warmHandler, httpEvent("GET", "/user")),
);

bench(
	"http-router: static with same radix",
	route(warmHandler, httpEvent("GET", "/user/comments")),
);

bench(
	"http-router: dynamic route",
	route(warmHandler, httpEvent("GET", "/user/lookup/username/john")),
);

bench(
	"http-router: mixed static dynamic",
	route(warmHandler, httpEvent("GET", "/event/abcd1234/comments")),
);

bench(
	"http-router: long static",
	route(warmHandler, httpEvent("GET", "/very/deeply/nested/route/hello/there")),
);

bench(
	"http-router: wildcard",
	route(warmHandler, httpEvent("GET", "/static/index.html")),
);

bench(
	"http-router: vpc static no query",
	route(warmHandler, vpcEvent("GET", "/user")),
);

bench(
	"http-router: vpc static with query",
	route(warmHandler, vpcEvent("GET", "/user?foo=bar&baz=qux")),
);

bench(
	"http-router: vpc dynamic no query",
	route(warmHandler, vpcEvent("GET", "/user/lookup/username/john")),
);

bench(
	"http-router: big router last-registered dynamic (3 segs)",
	route(warmBigHandler, httpEvent("GET", "/target/42/last")),
);
