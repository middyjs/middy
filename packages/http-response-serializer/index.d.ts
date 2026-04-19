// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface SerializerHandler {
	regex: RegExp;
	serializer: (
		response: any,
	) => string | { body: string; [key: string]: unknown };
}

export interface Options {
	serializers?: SerializerHandler[];
	defaultContentType?: string;
}

declare function httpResponseSerializer(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpResponseSerializerValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpResponseSerializer;
