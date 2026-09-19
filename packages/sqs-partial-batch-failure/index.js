// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "sqs-partial-batch-failure";
const pkg = `@middy/${name}`;

const defaults = {
	logger: (request, { reason }) => console.error(reason),
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const sqsPartialBatchFailureValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const sqsPartialBatchFailureMiddleware = (opts = {}) => {
	const { logger, omitPaths, mask } = { ...defaults, ...opts };

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	const sqsPartialBatchFailureMiddlewareAfter = (request) => {
		const {
			event: { Records },
			response,
		} = request;

		// https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
		// Required: include the value `ReportBatchItemFailures` in the `FunctionResponseTypes` list
		const batchItemFailures = [];
		if (Array.isArray(Records)) {
			// Redact once for the whole batch. Only the values handed to `logger`
			// come from the redacted copy; `status` and `messageId` stay raw so a
			// redaction can never change which records are reported failed.
			const safeRequest = omit(request, omitPathTree, mask);
			const safeRecords = safeRequest.event.Records;
			for (const [idx, record] of Records.entries()) {
				// A handler that did not return Promise.allSettled results (null, a
				// plain object) has no entry for any record, so every record fails.
				const { status } = response?.[idx] ?? {};
				if (status === "fulfilled") continue;
				batchItemFailures.push({ itemIdentifier: record.messageId });
				if (typeof logger === "function") {
					logger(safeRequest, {
						reason: safeRequest.response?.[idx]?.reason,
						record: safeRecords[idx],
					});
				}
			}
		}

		request.response = { batchItemFailures };
	};

	const sqsPartialBatchFailureMiddlewareOnError = async (request) => {
		if (typeof request.response !== "undefined") return;

		const length = request.event.Records?.length ?? 0;
		// Every record settles as rejected with the handler's error, in the
		// shape the after hook expects from Promise.allSettled.
		request.response = await Promise.allSettled(
			Array.from({ length }, () => Promise.reject(request.error)),
		);

		await sqsPartialBatchFailureMiddlewareAfter(request);
	};

	return {
		after: sqsPartialBatchFailureMiddlewareAfter,
		onError: sqsPartialBatchFailureMiddlewareOnError,
	};
};

export default sqsPartialBatchFailureMiddleware;
