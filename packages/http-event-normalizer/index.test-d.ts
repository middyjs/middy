import type middy from "@middy/core";
import { expect } from "tstyche";
import httpEventNormalizer, { type Event } from "./index.js";

// use with default options
let middleware = httpEventNormalizer();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();

// use with all options
middleware = httpEventNormalizer();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
