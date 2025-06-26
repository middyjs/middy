import type middy from "@middy/core";
import { expectType } from "tsd";
import urlEncodePathParser, { type Event } from "./index.js";

// use with default options
const middleware = urlEncodePathParser();
expectType<middy.MiddlewareObj<Event>>(middleware);
