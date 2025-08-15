import type middy from "@middy/core";
import { expect } from "tstyche";
import eventNormalizer from "./index.js";

// use with default options
let middleware = eventNormalizer();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = eventNormalizer();
expect(middleware).type.toBe<middy.MiddlewareObj>();
