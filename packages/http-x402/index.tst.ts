import type middy from "@middy/core";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { expect, test } from "tstyche";
import httpX402, { type Options, type RequestEvent } from "./index.js";

test("requires price, payTo, and asset", () => {
	const middleware = httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();
});

test("event type can be narrowed", () => {
	const middleware = httpX402<APIGatewayProxyEventV2>({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayProxyEventV2, unknown, Error>
	>();
});

test("versions toggle accepts 1 and 2 only", () => {
	const middleware = httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
		versions: [2],
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();

	const pinned = [2] as const;
	const readonlyVersions = httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
		versions: pinned,
	});
	expect(readonlyVersions).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();

	httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
		// @ts-expect-error not assignable
		versions: [3],
	});
});

test("all options", () => {
	const middleware = httpX402({
		facilitatorUrl: "https://my-facilitator.example.com/",
		versions: [1, 2],
		price: 0.001,
		decimals: 6,
		network: "eip155:8453",
		payTo: "0xpayto",
		asset: "0xasset",
		description: "Premium API access",
		mimeType: "application/json",
		extra: { name: "USDC", version: "2" },
		human: (request) => request.event.headers?.["x-human"] === "true",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();
});

test("custom FacilitatorClient class is accepted", () => {
	class CustomFacilitatorClient {
		async verify(_payload: unknown, _requirements: unknown): Promise<unknown> {
			return { isValid: true };
		}
		async settle(_payload: unknown, _requirements: unknown): Promise<unknown> {
			return { success: true };
		}
	}
	const middleware = httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
		FacilitatorClient: CustomFacilitatorClient,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();

	httpX402({
		price: 0.001,
		payTo: "0xpayto",
		asset: "0xasset",
		// @ts-expect-error not assignable
		FacilitatorClient: class {},
	});
});

test("string price is accepted", () => {
	const middleware = httpX402({
		price: "0.001",
		payTo: "0xpayto",
		asset: "0xasset",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();
});

test("amount override without price is accepted", () => {
	const middleware = httpX402({
		amount: "1000",
		payTo: "0xpayto",
		asset: "0xasset",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<RequestEvent, unknown, Error>
	>();
});

test("Options type requires price, payTo, asset", () => {
	// @ts-expect-error not assignable to type 'Options'
	const _opts: Options = {};
});

test("Options type requires price or amount", () => {
	// @ts-expect-error not assignable to type 'Options'
	const _opts: Options = { payTo: "0x", asset: "0x" };
});

test("Options type allows partial optional fields", () => {
	const opts: Options = { price: 0.001, payTo: "0x", asset: "0x" };
	expect(opts).type.toBeAssignableTo<Options>();
});
