import type middy from "@middy/core";
import { expectType } from "tsd";
import urlEncodeBodyParser, { type Event } from ".";

// use with default options
const middleware = urlEncodeBodyParser();
expectType<middy.MiddlewareObj<Event>>(middleware);
