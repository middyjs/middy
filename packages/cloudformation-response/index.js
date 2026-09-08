// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const name = "cloudformation-response";
const pkg = `@middy/${name}`;

// CloudFormation reads the response only from the PUT to `event.ResponseURL`
// (the Lambda return value is ignored) and caps the body at 4096 bytes.
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html
const MAX_RESPONSE_BYTES = 4096;
const TRUNCATED_NOTE = " [truncated]";

const defaults = {
	sendResponse: true,
};

const optionSchema = {
	type: "object",
	properties: {
		sendResponse: { type: "boolean" },
	},
	additionalProperties: false,
};

export const cloudformationResponseValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const cloudformationCustomResourceMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const cloudformationCustomResourceMiddlewareAfter = async (request) => {
		let { response } = request;
		response ??= {};
		// The response is a field map; a string, number or array can't carry
		// Status and friends, and would fail with "Cannot create property".
		if (typeof response !== "object" || Array.isArray(response)) {
			throw new TypeError(`${pkg}: handler response must be an object`, {
				cause: {
					package: pkg,
					data: { type: Array.isArray(response) ? "array" : typeof response },
				},
			});
		}
		response.Status ??= "SUCCESS";
		response.RequestId ??= request.event.RequestId;
		response.LogicalResourceId ??= request.event.LogicalResourceId;
		response.StackId ??= request.event.StackId;
		response.PhysicalResourceId ??=
			request.event.PhysicalResourceId ?? request.context.logStreamName;
		request.response = response;

		if (options.sendResponse && typeof request.event.ResponseURL === "string") {
			await sendResponse(request.event.ResponseURL, response);
		}
	};
	const cloudformationCustomResourceMiddlewareOnError = async (request) => {
		request.response = {
			Status: "FAILED",
			Reason: request.error?.message ?? String(request.error),
		};
		await cloudformationCustomResourceMiddlewareAfter(request);
	};
	return {
		after: cloudformationCustomResourceMiddlewareAfter,
		onError: cloudformationCustomResourceMiddlewareOnError,
	};
};

// Only `Reason` is free text, so it is what gets trimmed when the body would
// exceed the cap. The trimmed value is written back so the returned object
// and what CloudFormation received agree.
const serialize = (response) => {
	let body = JSON.stringify(response);
	// Stryker disable next-line ConditionalExpression,EqualityOperator: equivalent; this early return is a pure fast path. Without it (or with `<` at the exact-cap boundary) a body at or under the cap falls through to the trim loop and the final cap check, whose guards are both false for such a body, so the same untouched body is returned.
	if (Buffer.byteLength(body) <= MAX_RESPONSE_BYTES) return body;
	if (typeof response.Reason === "string") {
		let reason = response.Reason;
		while (reason.length > 0 && Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
			// Dropping a character frees at least one byte, so cutting by the
			// byte excess converges in a couple of passes even for multi-byte or
			// escaped text.
			reason = reason.slice(0, -(Buffer.byteLength(body) - MAX_RESPONSE_BYTES));
			response.Reason = `${reason}${TRUNCATED_NOTE}`;
			body = JSON.stringify(response);
		}
	}
	if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
		// Nothing else is safe to trim (Data, ids). Failing here turns into a
		// FAILED response with this reason instead of a stack that waits for
		// the timeout because CloudFormation refused the body.
		throw new Error(
			`${pkg}: response body exceeds ${MAX_RESPONSE_BYTES} bytes`,
			{
				cause: {
					package: pkg,
					data: { bytes: Buffer.byteLength(body) },
				},
			},
		);
	}
	return body;
};

const sendResponse = async (url, response) => {
	const body = serialize(response);
	// The presigned URL was signed with an empty content type, so any other
	// value fails the bucket's signature check (same as the cfn-response module).
	// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-lambda-function-code-cfnresponsemodule.html
	const res = await fetch(url, {
		method: "PUT",
		headers: { "content-type": "" },
		body,
	});
	if (!res.ok) {
		throw new Error(
			`${pkg}: CloudFormation rejected the response (${res.status})`,
			{
				cause: { package: pkg, data: { status: res.status } },
			},
		);
	}
};

export default cloudformationCustomResourceMiddleware;
