// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// The module object rather than a named import so a test's mock timers can
// intercept setTimeout; a named import binds the real function at load time.
import timers from "node:timers/promises";

const noop = () => {};

export const sqsMaxVisibilityTimeoutSeconds = 43_200;
// Time left after the handler's budget for DeleteMessageBatch, retries
// included, before a batch's messages become visible again.
export const sqsAcknowledgeHeadroomSeconds = 30;

// Backoff before a failed batch is fetched again: retryDelayMs, doubling per
// consecutive failure of the same record, capped at 30 s (or retryDelayMs
// when that is larger).
export const retryDelay = (retryDelayMs, attempt) =>
	Math.min(retryDelayMs * 2 ** (attempt - 1), Math.max(retryDelayMs, 30_000));

export const sleep = (ms, signal) =>
	timers.setTimeout(ms, undefined, { signal }).catch(noop);

// The AWS SDKs class a response with one of these HTTP status codes and no
// error code they recognize as transient, and I/O failures too (connection
// reset, DNS resolution failure, socket timeout).
// https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html
const transientStatusCodes = new Set([500, 502, 503, 504]);

// The codes Node.js gives those I/O failures. EAI_AGAIN is a temporary DNS
// failure, ENOTFOUND a lookup that failed.
// https://nodejs.org/api/errors.html#common-system-errors
// https://docs.libuv.org/en/v1.x/errors.html
const networkErrorCodes = new Set([
	"ECONNRESET",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EAI_AGAIN",
]);

export const isTransientReadError = (err, transientErrorNames) =>
	transientErrorNames.has(err.name) ||
	transientStatusCodes.has(err.$metadata?.httpStatusCode) ||
	networkErrorCodes.has(err.code);

export const mqBatcher = (opts) => {
	const batchSize = opts.batchSize ?? 10;
	const batchWindowMs = opts.batchWindowMs ?? 1000;
	// Lambda retries a failed Amazon MQ batch "until processing succeeds or the
	// messages expire".
	// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
	const maxRetryAttempts = opts.maxRetryAttempts ?? -1;
	const retryDelayMs = opts.retryDelayMs ?? 1000;

	const deliveries = [];
	const unacknowledged = new WeakMap();
	let resolveNext;
	let pollFailure;
	const abortOnFailure = new AbortController();

	const wakeReader = () => {
		resolveNext?.();
		resolveNext = undefined;
	};

	return {
		batchSize,
		wakeReader,
		deliver(delivery) {
			deliveries.push(delivery);
			wakeReader();
		},
		// A connection that can no longer deliver would leave the loop parked
		// forever. Fail the poll instead: the worker reports it through onError,
		// exits 1 and the primary re-forks it.
		failPoll(err) {
			pollFailure = err;
			abortOnFailure.abort();
			wakeReader();
		},
		async *batches(signal, { toEvent, discard }) {
			let heldForRetry = [];
			let failedAttempts = 0;
			while (!signal.aborted) {
				if (pollFailure) throw pollFailure;
				let batch = heldForRetry;
				if (batch.length === 0) {
					if (deliveries.length === 0) {
						await new Promise((resolve) => {
							resolveNext = resolve;
						});
						continue;
					}
					const windowEnd = Date.now() + batchWindowMs;
					while (
						deliveries.length < batchSize &&
						Date.now() < windowEnd &&
						!signal.aborted
					) {
						await timers.setTimeout(Math.min(50, windowEnd - Date.now()));
					}
					if (signal.aborted) return;
					batch = deliveries.splice(0, batchSize);
				}
				const event = toEvent(batch);
				unacknowledged.set(event, batch);
				yield event;
				if (signal.aborted) return;
				if (pollFailure) throw pollFailure;
				const acknowledged = !unacknowledged.delete(event);
				if (acknowledged) {
					heldForRetry = [];
					failedAttempts = 0;
					continue;
				}
				failedAttempts++;
				if (maxRetryAttempts !== -1 && failedAttempts > maxRetryAttempts) {
					discard(batch, event);
					heldForRetry = [];
					failedAttempts = 0;
					continue;
				}
				heldForRetry = batch;
				await sleep(
					retryDelay(retryDelayMs, failedAttempts),
					AbortSignal.any([signal, abortOnFailure.signal]),
				);
			}
		},
		// Lambda has no partial batch response for Amazon MQ: FunctionResponseTypes
		// applies to "Kinesis, DynamoDB Streams, Amazon MSK, self-managed Apache
		// Kafka, and Amazon SQS", and a batch either fails as a whole ("If your
		// function returns an error for any of the messages in a batch, Lambda
		// retries the whole batch") or succeeds as a whole.
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
		acknowledge(event) {
			const batch = unacknowledged.get(event) ?? [];
			unacknowledged.delete(event);
			return batch;
		},
	};
};
