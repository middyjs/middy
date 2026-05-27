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

	// Call recordHandler directly and pass its return (promise or value) straight
	// to allSettled. Wrapping each call in `async (record) => …` would allocate an
	// extra promise and add a microtask hop per record; the try/catch keeps the
	// sync-throw safety that wrapper provided without that per-record overhead.
	const settle = (record) => {
		try {
			return recordHandler(record, context);
		} catch (err) {
			return Promise.reject(err);
		}
	};
	return Promise.allSettled(records.map(settle));
};

export default eventBatchHandler;
