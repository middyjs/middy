// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	buildPathTree,
	omit,
	omitPathsSchema,
	validateOmitPaths,
	validateOptions,
} from "@middy/util";

const name = "sqs-partial-batch-failure";
const pkg = `@middy/${name}`;

const defaults = {
	logger: (request, { reason }) => console.error(reason),
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:sqs-partial-batch-failure:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		logger: {
			oneOf: [{ $ref: "#/$defs/Function" }, { type: "boolean", const: false }],
		},
		omitPaths: omitPathsSchema,
		mask: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const sqsPartialBatchFailureValidateOptions = (options) => {
	const validated = validateOptions(pkg, optionSchema, options);
	validateOmitPaths(validated.omitPaths);
	return validated;
};

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
		const pendingLoggers = [];
		if (Array.isArray(Records)) {
			let safeRequest;
			// FIFO: "your function should stop processing messages after the
			// first failure and return all failed and unprocessed messages in
			// batchItemFailures". FIFO queue names end in `.fifo`.
			// https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
			const fifo = Records[0]?.eventSourceARN?.endsWith(".fifo") === true;
			let failed = false;
			for (const [idx, record] of Records.entries()) {
				// A handler that did not return Promise.allSettled results (null, a
				// plain object) has no entry for any record, so every record fails.
				const { status } = response?.[idx] ?? {};
				if (status === "fulfilled" && !failed) continue;
				// In FIFO every record after the first failure is reported too.
				failed = fifo;
				batchItemFailures.push({ itemIdentifier: record.messageId });
				if (typeof logger === "function") {
					try {
						safeRequest ??= omit(request, omitPathTree, mask);
						const logged = logger(safeRequest, {
							reason: safeRequest.response?.[idx]?.reason,
							record: redactedRecord(safeRequest, idx),
						});
						if (typeof logged?.then === "function") {
							pendingLoggers.push(settleLoggerPromise(logged));
						}
					} catch (e) {
						console.error(e);
					}
				}
			}
		}

		request.response = { batchItemFailures };

		if (pendingLoggers.length > 0) {
			return waitForLoggers(pendingLoggers);
		}
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

const settleLoggerPromise = async (logged) => {
	try {
		await logged;
	} catch (e) {
		console.error(e);
	}
};

const waitForLoggers = async (pendingLoggers) => {
	await Promise.all(pendingLoggers);
};

const redactedRecord = (safeRequest, idx) => {
	const safeRecords = safeRequest.event?.Records;
	return Array.isArray(safeRecords) ? safeRecords[idx] : undefined;
};

export default sqsPartialBatchFailureMiddleware;
