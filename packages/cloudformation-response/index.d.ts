// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

declare function cloudformationResponse(): middy.MiddlewareObj<
	unknown,
	unknown,
	Error
>;

export default cloudformationResponse;
