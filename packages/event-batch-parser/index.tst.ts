import type middy from "@middy/core";
import { expect, test } from "tstyche";
import eventBatchParser, {
	parseAvro,
	parseJson,
	parseProtobuf,
	type RecordParser,
} from "./index.js";

test("default export returns a MiddlewareObj", () => {
	expect(eventBatchParser()).type.toBe<middy.MiddlewareObj>();
});

test("parser factories return RecordParser", () => {
	expect(parseJson()).type.toBe<RecordParser>();
	expect(parseAvro()).type.toBe<RecordParser>();
	expect(parseAvro({ schema: { type: "string" } })).type.toBe<RecordParser>();
	expect(
		parseProtobuf({
			root: {
				lookupType: () => ({
					decode: () => ({ toJSON: () => ({}) }),
				}),
			},
			messageType: "Foo",
		}),
	).type.toBe<RecordParser>();
});

test("middleware accepts key/value/body/data parsers", () => {
	expect(
		eventBatchParser({
			key: parseJson(),
			value: parseAvro({ schema: {} }),
		}),
	).type.toBe<middy.MiddlewareObj>();

	expect(
		eventBatchParser({
			body: parseJson(),
		}),
	).type.toBe<middy.MiddlewareObj>();

	expect(
		eventBatchParser({
			data: parseJson(),
		}),
	).type.toBe<middy.MiddlewareObj>();
});
