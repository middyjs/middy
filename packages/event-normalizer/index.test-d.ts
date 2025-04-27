import type middy from "@middy/core";
import { expectType } from "tsd";
import eventNormalizer from ".";

// use with default options
let middleware = eventNormalizer();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = eventNormalizer();
expectType<middy.MiddlewareObj>(middleware);
