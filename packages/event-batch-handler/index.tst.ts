import type { Context } from "aws-lambda";
import { expect, test } from "tstyche";
import eventBatchHandler from "./index.js";

const ctx = {} as Context;

test("infers record + result types", () => {
	const handler = eventBatchHandler<{ id: string }, number>(
		(record, context) => {
			expect(record).type.toBe<{ id: string }>();
			expect(context).type.toBe<Context>();
			return 1;
		},
	);
	expect(handler({}, ctx)).type.toBe<Promise<PromiseSettledResult<number>[]>>();
});

test("defaults to unknown record + unknown result", () => {
	const handler = eventBatchHandler((record) => record);
	expect(handler({}, ctx)).type.toBe<
		Promise<PromiseSettledResult<unknown>[]>
	>();
});

test("narrowable to a Durable-shaped context via the third generic", () => {
	type DurableContextLike = Context & {
		step: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
	};
	const durable = {} as DurableContextLike;
	const handler = eventBatchHandler<{ id: number }, string, DurableContextLike>(
		(record, context) => {
			expect(record).type.toBe<{ id: number }>();
			expect(context).type.toBe<DurableContextLike>();
			return context.step("enrich", async () => "ok");
		},
	);
	expect(handler({}, durable)).type.toBe<
		Promise<PromiseSettledResult<string>[]>
	>();
});
