// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { flattenBatchRecords } from "@middy/event-batch-response";
import { isExecutionModeDurable } from "@middy/util";

const eventBatchHandler = (recordHandler) => async (event, context) => {
	const records = flattenBatchRecords(event);

	if (isExecutionModeDurable(context)) {
		const settled = await Promise.allSettled(
			records.map((record, idx) =>
				context.step(`record-${idx}`, async (stepCtx) =>
					recordHandler(record, stepCtx),
				),
			),
		);
		const firstFailure = settled.find((s) => s.status === "rejected");
		if (firstFailure) throw firstFailure.reason;
		return settled;
	}

	return Promise.allSettled(
		records.map(async (record) => recordHandler(record, context)),
	);
};

export default eventBatchHandler;
