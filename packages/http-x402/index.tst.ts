import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpX402, { type Options } from "./index.js";

test("requires price, payTo, and asset", () => {
	const middleware = httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("all options", () => {
	const middleware = httpX402({
		facilitatorUrl: "https://my-facilitator.example.com/",
		price: 0.001,
		decimals: 6,
		network: "eip155:8453",
		payTo: "0xpayto",
		asset: "0xasset",
		description: "Premium API access",
		mimeType: "application/json",
		human: (request) =>
			(request.event as { headers?: Record<string, string> })?.headers?.[
				"x-human"
			] === "true",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("Options type requires price, payTo, asset", () => {
	// @ts-expect-error missing the following properties
	const _opts: Options = {};
});

test("Options type allows partial optional fields", () => {
	const opts: Options = { price: 0.001, payTo: "0x", asset: "0x" };
	expect(opts).type.toBe<Options>();
});
