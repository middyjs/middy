// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { jsonParseProtectProto } from "@middy/util";

const pkg = "@middy/event-batch-parser";

// `jsonParseProtectProto` rejects an own `__proto__` key and a `constructor`
// carrying `prototype` with a 422, so a crafted record can't hand a prototype
// gadget to whatever `Object.assign`s the parsed value downstream.
export const parseJson =
	(parserOpts = {}) =>
	(buffer, _record, _request, framing) =>
		jsonParseProtectProto(
			(framing?.payload ?? buffer).toString("utf-8"),
			parserOpts.reviver,
			pkg,
		);

export default parseJson;
