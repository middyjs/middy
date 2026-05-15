// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export const parseJson =
	(parserOpts = {}) =>
	(buffer, _record, _request, framing) =>
		JSON.parse(
			(framing?.payload ?? buffer).toString("utf-8"),
			parserOpts.reviver,
		);

export default parseJson;
