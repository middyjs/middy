// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const cloudformationCustomResourceMiddleware = () => {
	const cloudformationCustomResourceMiddlewareAfter = (request) => {
		let { response } = request;
		response ??= {};
		response.Status ??= "SUCCESS";
		response.RequestId ??= request.event.RequestId;
		response.LogicalResourceId ??= request.event.LogicalResourceId;
		response.StackId ??= request.event.StackId;
		request.response = response;
	};
	const cloudformationCustomResourceMiddlewareOnError = (request) => {
		const response = {
			Status: "FAILED",
			Reason: request.error.message,
		};
		request.response = response;
		cloudformationCustomResourceMiddlewareAfter(request);
	};
	return {
		after: cloudformationCustomResourceMiddlewareAfter,
		onError: cloudformationCustomResourceMiddlewareOnError,
	};
};

export default cloudformationCustomResourceMiddleware;
