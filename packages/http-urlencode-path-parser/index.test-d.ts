import type middy from "@middy/core";
import { expect } from "tstyche";
import urlEncodePathParser, { type Event } from "./index.js";

// use with default options
const middleware = urlEncodePathParser();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
