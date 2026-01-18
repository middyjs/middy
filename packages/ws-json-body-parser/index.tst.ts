import type middy from "@middy/core";
import { expect, test } from "tstyche";
import jsonBodyParser, { type Event } from "./index.js";

test("use with default options", () => {
	expect(jsonBodyParser()).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const options = {
		reviver: (key: string, value: any) => Boolean(value),
	};
	expect(jsonBodyParser(options)).type.toBe<middy.MiddlewareObj<Event>>();
});
