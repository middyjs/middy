import type middy from "@middy/core";
import { expect, test } from "tstyche";
import eventBatchResponse from "./index.js";

test("returns a middleware", () => {
	const middleware = eventBatchResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
