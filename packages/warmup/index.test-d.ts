import type middy from "@middy/core";
import { expect } from "tstyche";
import warmup from "./index.js";

// use with default options
let middleware = warmup();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = warmup({
	isWarmingUp: () => true,
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
