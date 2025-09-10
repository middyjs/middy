import type middy from "@middy/core";
import { expect, test } from "tstyche";
import warmup from "./index.js";

test("use with default options", () => {
	const middleware = warmup();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = warmup({
		isWarmingUp: () => true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
