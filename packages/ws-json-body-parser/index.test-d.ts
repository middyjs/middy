import type middy from "@middy/core";
import { expectType } from "tsd";
import jsonBodyParser, { type Event } from ".";

// use with default options
expectType<middy.MiddlewareObj<Event>>(jsonBodyParser());

// use with all options
const options = {
	reviver: (key: string, value: any) => Boolean(value),
};
expectType<middy.MiddlewareObj<Event>>(jsonBodyParser(options));
