// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const httpUrlencodePathParserMiddlewareBefore = async (request) => {
	if (!request.event.pathParameters) return;
	for (const key in request.event.pathParameters) {
		request.event.pathParameters[key] = decodeURIComponent(
			request.event.pathParameters[key],
		);
	}
};

const httpUrlencodePathParserMiddleware = () => ({
	before: httpUrlencodePathParserMiddlewareBefore,
});
export default httpUrlencodePathParserMiddleware;
