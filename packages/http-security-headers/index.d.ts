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
	poweredBy?: boolean;
	strictTransportSecurity?: {
		maxAge?: number;
		includeSubDomains?: boolean;
		/**
		 * Asks for inclusion in the browsers' HSTS preload list, which is slow to
		 * undo. Sent only when `maxAge` is at least one year.
		 * @default false
		 */
		preload?: boolean;
	};
	downloadOptions?: {
		action?: string;
	};
	contentTypeOptions?: {
		action?: string;
	};
	/** `{}` is the default; the object form takes no properties. */
	originAgentCluster?: boolean | Record<string, never>;
	referrerPolicy?: {
		policy?: string;
	};
	/** The object form takes no properties. */
	xssProtection?: boolean | Record<string, never>;
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
	/** @deprecated Use `reportingEndpoints`. Removed in v9. */
	reportTo?: {
		maxAge?: number;
		default?: string;
		includeSubDomains?: boolean;
		/** @deprecated Legacy casing, use `includeSubDomains`. Removed in v9. */
		includeSubdomains?: boolean;
		csp?: string;
		staple?: string;
		xss?: string;
	};
}

type WithBoolValues<T> = { [K in keyof T]: T[K] | boolean };

declare function httpSecurityHeaders(
	options?: WithBoolValues<Options>,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpSecurityHeadersValidateOptions<
	TOptions extends WithBoolValues<Options>,
>(options?: TOptions): TOptions;

export default httpSecurityHeaders;
