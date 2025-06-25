import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
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

await bench
	.add(
		"short static",
		async (
			event = {
				version: "2.0",
				requestContext: { http: { method: "GET", path: "/user" } },
			},
		) => {
			await warmHandler(event, context);
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
			await warmHandler(event, context);
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
			await warmHandler(event, context);
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
			await warmHandler(event, context);
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
			await warmHandler(event, context);
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
			await warmHandler(event, context);
		},
	)

	.run();

console.table(bench.table());
