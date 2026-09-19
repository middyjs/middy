// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface CloudformationResponseOptions {
	// PUT the shaped response to `event.ResponseURL`, which is what
	// CloudFormation reads. Default `true`.
	sendResponse?: boolean;
}

declare function cloudformationResponse(
	options?: CloudformationResponseOptions,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function cloudformationResponseValidateOptions(
	options?: Record<string, unknown>,
): void;

export default cloudformationResponse;
