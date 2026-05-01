import type { Handler as LambdaHandler } from "aws-lambda";
import { expect, test } from "tstyche";
import ecsTaskRunner, {
	type EcsTaskRunnerOptions,
	ecsTaskValidateOptions,
} from "./index.js";

interface MyEvent {
	id: string;
}
interface MyResult {
	ok: boolean;
}

const handler: LambdaHandler<MyEvent, MyResult> = async () => ({ ok: true });

test("EcsTaskRunnerOptions accepts a typed handler", () => {
	const options: EcsTaskRunnerOptions<MyEvent, MyResult> = { handler };
	expect(options).type.toBeAssignableTo<
		EcsTaskRunnerOptions<MyEvent, MyResult>
	>();
});

test("EcsTaskRunnerOptions accepts all optional fields", () => {
	const options: EcsTaskRunnerOptions<MyEvent, MyResult> = {
		handler,
		eventEnv: "MY_EVENT",
		eventArg: false,
		timeout: 30_000,
		stopTimeout: 5_000,
		onSuccess: async (result) => {
			expect(result).type.toBe<MyResult>();
		},
		onFailure: async (error) => {
			expect(error).type.toBe<unknown>();
		},
	};
	expect(options).type.toBeAssignableTo<
		EcsTaskRunnerOptions<MyEvent, MyResult>
	>();
});

test("ecsTaskRunner returns Promise", () => {
	const result = ecsTaskRunner({ handler });
	expect(result).type.toBe<Promise<unknown>>();
});

test("ecsTaskValidateOptions accepts a record", () => {
	expect(ecsTaskValidateOptions).type.toBeCallableWith({});
	expect(ecsTaskValidateOptions).type.toBeCallableWith();
});
