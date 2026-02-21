// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	logger: console.error,
};

const sqsPartialBatchFailureMiddleware = (opts = {}) => {
	const { logger } = { ...defaults, ...opts };

	const sqsPartialBatchFailureMiddlewareAfter = async (request) => {
		const {
			event: { Records },
			response,
		} = request;

		// https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
		// Required: include the value `ReportBatchItemFailures` in the `FunctionResponseTypes` list
		const batchItemFailures = [];
		if (Array.isArray(Records)) {
			for (const [idx, record] of Object.entries(Records)) {
				const { status, reason } = response[idx];
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
		if (request.response !== undefined) return;

		request.response = new Array(request.event.Records?.length).fill({
			status: "rejected",
			reason: request.error,
		});

		await sqsPartialBatchFailureMiddlewareAfter(request);
	};

	return {
		after: sqsPartialBatchFailureMiddlewareAfter,
		onError: sqsPartialBatchFailureMiddlewareOnError,
	};
};

export default sqsPartialBatchFailureMiddleware;
