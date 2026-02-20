// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface SerializerHandler {
	regex: RegExp;
	serializer: (response: any) => string | { body: any; [key: string]: any };
}

interface Options {
	serializers?: SerializerHandler[];
	defaultContentType?: string;
}

declare function httpResponseSerializer(options?: Options): middy.MiddlewareObj;

export default httpResponseSerializer;
