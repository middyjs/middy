// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface Options {
	eventSchema?: Function | any;
	contextSchema?: Function | any;
	responseSchema?: Function | any;
	defaultLanguage?: string;
	languages?: object | any;
}

declare function validator(options?: Options): middy.MiddlewareObj;

export default validator;
