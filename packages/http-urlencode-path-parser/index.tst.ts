import type middy from "@middy/core";
import { expect, test } from "tstyche";
import urlEncodePathParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = urlEncodePathParser();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
