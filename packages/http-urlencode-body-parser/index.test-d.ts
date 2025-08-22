import type middy from "@middy/core";
import { expect } from "tstyche";
import urlEncodeBodyParser, { type Event } from "./index.js";

// use with default options
const middleware = urlEncodeBodyParser();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
