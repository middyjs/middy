import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpEventNormalizer, {
	type Event,
	type VPCLatticeEvent,
} from "./index.js";

test("use with default options", () => {
	const middleware = httpEventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event, unknown, Error>>();
});

test("VPCLatticeEvent type is exported", () => {
	const event: VPCLatticeEvent = {
		body: null,
		headers: {},
		is_base64_encoded: false,
		isBase64Encoded: false,
		method: "GET",
		path: "/",
		pathParameters: {},
		query_string_parameters: null,
		queryStringParameters: {},
	};
	expect(event).type.toBe<VPCLatticeEvent>();
});
