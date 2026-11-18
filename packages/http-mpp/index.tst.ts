import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpMpp, { type MethodOptions } from "./index.js";

test("use with required methods", () => {
	const middleware = httpMpp({
		methods: [
			{ method: "tempo", recipient: "0x", currency: "0x", amount: 0.01 },
		],
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpMpp({
		realm: "api",
		methods: [
			{ method: "tempo", recipient: "0xabc", currency: "0xdef", amount: 0.01 },
			{
				method: "lightning",
				recipient: "lnbc...",
				currency: "BTC",
				amount: 0.0001,
			},
		],
		verify: async (token: string) => token.length > 0,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("verify receives middy.Request as second argument", () => {
	httpMpp({
		methods: [
			{ method: "tempo", recipient: "0x", currency: "0x", amount: 0.01 },
		],
		verify: async (token: string, request: middy.Request) =>
			request.event !== undefined,
	});
});

test("verify can be synchronous", () => {
	httpMpp({
		methods: [
			{ method: "tempo", recipient: "0x", currency: "0x", amount: 0.01 },
		],
		verify: (token: string) => token.length > 0,
	});
});

test("MethodOptions interface is exported", () => {
	const method: MethodOptions = {
		method: "tempo",
		recipient: "0x",
		currency: "0x",
		amount: 0.01,
	};
	expect(method).type.toBe<MethodOptions>();
});
