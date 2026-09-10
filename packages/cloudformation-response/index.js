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
		// Reason is required when Status is FAILED.
		if (response.Status === "FAILED") response.Reason ??= "See CloudWatch logs";
		response.RequestId ??= request.event.RequestId;
		response.LogicalResourceId ??= request.event.LogicalResourceId;
		response.StackId ??= request.event.StackId;
		// PhysicalResourceId must be a non-empty string. Outside Lambda there is
		// no log stream, so the request id is the next stable identifier.
		response.PhysicalResourceId ??=
			request.event.PhysicalResourceId ??
			request.context.logStreamName ??
			request.context.awsRequestId;
		if (response.PhysicalResourceId === undefined) {
			throw new Error(
				`${pkg}: PhysicalResourceId is required and neither the event nor the context provides one`,
				{ cause: { package: pkg, data: { field: "PhysicalResourceId" } } },
			);
		}
		request.response = response;

		if (options.sendResponse && typeof request.event.ResponseURL === "string") {
			await sendResponse(request.event.ResponseURL, response, request.context);
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
// Bytes a character occupies in the JSON body: its UTF-8 length, plus the
// escaping JSON.stringify adds for quotes, backslashes and control characters.
const jsonBytes = (char) => Buffer.byteLength(JSON.stringify(char)) - 2;

const serialize = (response) => {
	let body = JSON.stringify(response);
	if (Buffer.byteLength(body) <= MAX_RESPONSE_BYTES) return body;
	if (typeof response.Reason === "string") {
		const reason = response.Reason;
		// Everything but the free text is fixed, so what is left of the cap
		// once the note is in place is the budget for whole characters. Walking
		// code points keeps multi-byte text and never splits a surrogate pair.
		response.Reason = TRUNCATED_NOTE;
		let budget =
			MAX_RESPONSE_BYTES - Buffer.byteLength(JSON.stringify(response));
		let kept = "";
		for (const char of reason) {
			const bytes = jsonBytes(char);
			if (bytes > budget) break;
			budget -= bytes;
			kept += char;
		}
		response.Reason = `${kept}${TRUNCATED_NOTE}`;
		body = JSON.stringify(response);
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

const sendResponse = async (url, response, context) => {
	// The response goes to a presigned S3 URL, which is always https. Anything
	// else would send the body, and with it the stack's ids, elsewhere.
	const protocol = URL.parse(url)?.protocol;
	if (protocol !== "https:") {
		throw new Error(`${pkg}: ResponseURL must be an https URL`, {
			cause: { package: pkg, data: { protocol } },
		});
	}
	const body = serialize(response);
	// A PUT that hangs past the invocation would be cut off by Lambda without
	// a response; abort it 500 ms early instead so the failure is logged.
	// Outside Lambda (no remaining-time budget) allow 30 s.
	const budget = (context.getRemainingTimeInMillis?.() ?? 30_000) - 500;
	// The presigned URL was signed with an empty content type, so any other
	// value fails the bucket's signature check (same as the cfn-response module).
	// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-lambda-function-code-cfnresponsemodule.html
	const res = await fetch(url, {
		method: "PUT",
		headers: { "content-type": "" },
		body,
		signal: AbortSignal.timeout(Math.max(1000, budget)),
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
