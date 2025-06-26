import type middy from "@middy/core";
import { expectType } from "tsd";
import warmup from "./index.js";

// use with default options
let middleware = warmup();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = warmup({
	isWarmingUp: () => true,
});
expectType<middy.MiddlewareObj>(middleware);
