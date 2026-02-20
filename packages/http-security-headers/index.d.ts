// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	dnsPrefetchControl?: {
		allow?: boolean;
	};
	frameOptions?: {
		action?: string;
	};
	poweredBy?:
		| {
				server: string;
		  }
		| boolean;
	strictTransportSecurity?: {
		maxAge?: number;
		includeSubDomains?: boolean;
		preload?: boolean;
	};
	downloadOptions?: {
		action?: string;
	};
	contentTypeOptions?: {
		action?: string;
	};
	originAgentCluster?: boolean;
	referrerPolicy?: {
		policy?: string;
	};
	xssProtection?: {
		reportUri?: string;
	};
	contentSecurityPolicy?: Record<string, string>;
	contentSecurityPolicyReportOnly?: boolean;
	crossOriginEmbedderPolicy?: {
		policy?: string;
	};
	crossOriginOpenerPolicy?: {
		policy?: string;
	};
	crossOriginResourcePolicy?: {
		policy?: string;
	};
	permissionsPolicy?: Record<string, string>;
	reportingEndpoints?: Record<string, string>;
	permittedCrossDomainPolicies?: {
		policy?: string;
	};
	reportTo?: {
		maxAge?: number;
		default?: string;
		includeSubdomains?: boolean;
		csp?: string;
		staple?: string;
		xss?: string;
	};
}

type WithBoolValues<T> = { [K in keyof T]: T[K] | boolean };

declare function httpSecurityHeaders(
	options?: WithBoolValues<Options>,
): middy.MiddlewareObj;

export default httpSecurityHeaders;
