// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const name = "sqs-partial-batch-failure";
const pkg = `@middy/${name}`;

const defaults = {
	logger: console.error,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
	},
	additionalProperties: false,
};

export const sqsPartialBatchFailureValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const sqsPartialBatchFailureMiddleware = (opts = {}) => {
	const { logger } = { ...defaults, ...opts };

	const sqsPartialBatchFailureMiddlewareAfter = (request) => {
		const {
			event: { Records },
			response,
		} = request;

		// https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
		// Required: include the value `ReportBatchItemFailures` in the `FunctionResponseTypes` list
		const batchItemFailures = [];
		// Stryker disable next-line ArrayDeclaration: equivalent - the fallback array is only used when response is not an array; entries are looked up by index and destructured for `status`, and no non-empty fallback content can ever yield status === "fulfilled", so all records fail identically with reason undefined.
		const settled = Array.isArray(response) ? response : [];
		if (Array.isArray(Records)) {
			for (const [idx, record] of Records.entries()) {
				const { status, reason } = settled[idx] ?? {};
				if (status === "fulfilled") continue;
				batchItemFailures.push({ itemIdentifier: record.messageId });
				if (typeof logger === "function") {
					logger(reason, record);
				}
			}
		}

		request.response = { batchItemFailures };
	};

	const sqsPartialBatchFailureMiddlewareOnError = async (request) => {
		if (typeof request.response !== "undefined") return;

		const length = request.event.Records?.length ?? 0;
		request.response = Array.from({ length }, () => ({
			// Stryker disable next-line StringLiteral: equivalent - `status` is only compared against "fulfilled" in the after handler; any non-"fulfilled" value (including "") is treated as a failure identically, so the literal value is unobservable.
			status: "rejected",
			reason: request.error,
		}));

		await sqsPartialBatchFailureMiddlewareAfter(request);
	};

	return {
		after: sqsPartialBatchFailureMiddlewareAfter,
		onError: sqsPartialBatchFailureMiddlewareOnError,
	};
};

export default sqsPartialBatchFailureMiddleware;
